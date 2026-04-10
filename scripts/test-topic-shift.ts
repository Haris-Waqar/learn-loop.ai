/**
 * Phase 5 test: verify topic-shift detection both directly and through
 * the ask route complete payload.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-topic-shift.ts
 */
import * as dotenv from 'dotenv';
import Module from 'module';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import type { Message, SerializedVector, SessionState } from '../types/session';

type ModuleWithResolver = typeof Module & {
  _resolveFilename: (
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
    options?: unknown,
  ) => string;
};

const moduleWithResolver = Module as ModuleWithResolver;
const originalResolveFilename = moduleWithResolver._resolveFilename;
moduleWithResolver._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = resolve(process.cwd(), request.slice(2));
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const material = `
Photosynthesis occurs in chloroplasts and begins with the light-dependent reactions, which capture light energy to produce ATP and NADPH.
The Calvin cycle uses ATP and NADPH to fix carbon dioxide into sugars.
Stomata regulate gas exchange in plant leaves.
`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

interface ParsedSseEvent<T = unknown> {
  event: string;
  data: T;
}

function parseSseBuffer<T>(buffer: string): { events: ParsedSseEvent<T>[]; remainder: string } {
  const rawEvents = buffer.split('\n\n');
  const completeEvents = rawEvents.slice(0, -1);
  const remainder = rawEvents.at(-1) ?? '';

  const events = completeEvents
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((line) => line.startsWith('event: '))?.slice(7) ?? '';
      const dataLine = lines.find((line) => line.startsWith('data: '))?.slice(6) ?? '';

      if (!event || !dataLine) {
        return null;
      }

      return { event, data: JSON.parse(dataLine) as T };
    })
    .filter((value): value is ParsedSseEvent<T> => value !== null);

  return { events, remainder };
}

async function collectSseEvents<T>(response: Response): Promise<ParsedSseEvent<T>[]> {
  assert(response.body, 'Expected ask route to return a readable stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: ParsedSseEvent<T>[] = [];
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer<T>(buffer);
    events.push(...parsed.events);
    buffer = parsed.remainder;
  }

  buffer += decoder.decode();
  const parsed = parseSseBuffer<T>(`${buffer}\n\n`);
  events.push(...parsed.events);

  return events;
}

async function startSession(postRoute: typeof import('../app/api/session/start/route').POST): Promise<SessionState> {
  const response = await postRoute(
    new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ material }),
    }),
  );
  const json = (await response.json()) as { success: boolean; data?: SessionState; error?: string };
  assert(response.ok, `Session start failed: ${json.error ?? 'unknown error'}`);
  assert(json.success && json.data, 'Expected session data from start route.');
  return json.data;
}

async function askQuestion(
  postRoute: typeof import('../app/api/session/ask/route').POST,
  payload: {
    question: string;
    persona: string;
    currentSubject: string;
    currentSubtopic: string;
    recentMessages: Message[];
    rollingSum: string;
    serializedVectors: SerializedVector[];
  },
) {
  const response = await postRoute(
    new Request('http://localhost/api/session/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );

  assert(response.ok, `Ask route failed with status ${response.status}.`);
  const events = await collectSseEvents<Record<string, unknown>>(response);
  const completeEvent = events.find((event) => event.event === 'complete');
  assert(completeEvent, 'Expected a complete event.');
  return completeEvent.data as {
    topicShift: { shifted: boolean; newSubject: string | null };
  };
}

async function main() {
  const { runTopicShiftChain } = (await import('../lib/langchain/chains/topicShiftChain')) as typeof import('../lib/langchain/chains/topicShiftChain');
  const { POST: startPOST } = (await import('../app/api/session/start/route')) as typeof import('../app/api/session/start/route');
  const { POST: askPOST } = (await import('../app/api/session/ask/route')) as typeof import('../app/api/session/ask/route');

  const onTopic = await runTopicShiftChain({
    currentSubject: 'Biology',
    currentSubtopic: 'Photosynthesis',
    userMessage: 'Can you explain the Calvin cycle more simply?',
  });
  assert(onTopic.shifted === false, 'Expected on-topic follow-up to stay within the current subject.');

  const offTopic = await runTopicShiftChain({
    currentSubject: 'Biology',
    currentSubtopic: 'Photosynthesis',
    userMessage: 'How do JavaScript promises work in Node.js?',
  });
  assert(offTopic.shifted === true, 'Expected clearly off-topic question to trigger a topic shift.');
  assert(offTopic.newSubject, 'Expected newSubject when shift is detected.');

  const session = await startSession(startPOST);
  const askResult = await askQuestion(askPOST, {
    question: 'How do JavaScript promises work in Node.js?',
    persona: session.persona,
    currentSubject: session.subject,
    currentSubtopic: session.subtopic,
    recentMessages: [],
    rollingSum: '',
    serializedVectors: session.serializedVectors,
  });

  assert(askResult.topicShift.shifted === true, 'Expected ask route to surface topic shift in complete event.');

  console.log('\nInput');
  console.log(`- Direct on-topic message: Can you explain the Calvin cycle more simply?`);
  console.log(`- Direct off-topic message: How do JavaScript promises work in Node.js?`);
  console.log(`- Ask route subject/subtopic: ${session.subject} / ${session.subtopic}`);
  console.log(`- Ask route question: How do JavaScript promises work in Node.js?`);

  console.log('\nTopic-shift results');
  console.log(`- Direct on-topic check: ${onTopic.shifted}`);
  console.log(`- Direct off-topic check: ${offTopic.shifted} (${offTopic.newSubject})`);
  console.log(`- Ask route off-topic check: ${askResult.topicShift.shifted}`);
  console.log('\n✓ Phase 5 topic-shift test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
