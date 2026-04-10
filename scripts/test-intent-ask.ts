/**
 * Phase 8.5 test: verify intent-routed chat dispatch through /api/session/ask.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-intent-ask.ts
 */
import * as dotenv from 'dotenv';
import Module from 'module';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import type { Message, SessionState } from '../types/session';

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const material = `
Photosynthesis occurs in chloroplasts. Light-dependent reactions produce ATP and NADPH.
The Calvin cycle uses those molecules to fix carbon dioxide into sugars.
Chlorophyll absorbs red and blue wavelengths efficiently, and stomata regulate gas exchange.
`;

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

async function ask(
  postRoute: typeof import('../app/api/session/ask/route').POST,
  session: SessionState,
  recentMessages: Message[],
  rollingSum: string,
  question: string,
) {
  const response = await postRoute(
    new Request('http://localhost/api/session/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question,
        material: session.material,
        summary: session.summary,
        memorables: session.memorables,
        persona: session.persona,
        currentSubject: session.subject,
        currentSubtopic: session.subtopic,
        recentMessages,
        rollingSum,
        serializedVectors: session.serializedVectors,
      }),
    }),
  );

  assert(response.ok, `Ask route failed with status ${response.status}.`);
  const events = await collectSseEvents<Record<string, unknown>>(response);
  const completeEvent = events.find((event) => event.event === 'complete');
  assert(completeEvent, 'Expected a complete event.');
  return completeEvent.data;
}

async function main() {
  const { POST: startPOST } = (await import('../app/api/session/start/route')) as typeof import('../app/api/session/start/route');
  const { POST: askPOST } = (await import('../app/api/session/ask/route')) as typeof import('../app/api/session/ask/route');

  const session = await startSession(startPOST);
  let recentMessages = session.recentMessages;
  let rollingSum = session.rollingSum;

  const qa = await ask(askPOST, session, recentMessages, rollingSum, 'Explain the Calvin cycle.');
  assert(qa.intent === 'qa', 'Expected QA intent for explanation prompt.');
  assert(typeof qa.answer === 'string', 'Expected QA answer payload.');
  recentMessages = qa.updatedMessages as Message[];
  rollingSum = qa.rollingSum as string;

  const summary = await ask(askPOST, session, recentMessages, rollingSum, 'Summarize this session.');
  assert(summary.intent === 'summarize', 'Expected summarize intent.');
  assert(typeof summary.summary === 'string' && summary.summary.length > 0, 'Expected summary payload.');
  session.summary = summary.summary as string;
  recentMessages = summary.updatedMessages as Message[];
  rollingSum = summary.rollingSum as string;

  const memorables = await ask(
    askPOST,
    session,
    recentMessages,
    rollingSum,
    'Give me the key things to remember from this topic.',
  );
  assert(memorables.intent === 'memorables', 'Expected memorables intent.');
  assert(Array.isArray(memorables.memorables) && memorables.memorables.length >= 5, 'Expected memorables payload.');
  recentMessages = memorables.updatedMessages as Message[];
  rollingSum = memorables.rollingSum as string;

  session.memorables = memorables.memorables as string[];

  const flashcards = await ask(askPOST, session, recentMessages, rollingSum, 'Make flashcards from this.');
  assert(flashcards.intent === 'flashcards', 'Expected flashcards intent.');
  assert(Array.isArray(flashcards.flashcards) && flashcards.flashcards.length >= 5, 'Expected flashcards payload.');
  recentMessages = flashcards.updatedMessages as Message[];
  rollingSum = flashcards.rollingSum as string;

  const ambiguous = await ask(askPOST, session, recentMessages, rollingSum, 'Can you help with this topic?');
  assert(ambiguous.intent === 'qa', 'Ambiguous prompt should default to qa.');
  assert(
    recentMessages.every((message) => message.content.length < 200),
    'Non-QA intents should add compact assistant status messages rather than structured payloads.',
  );

  console.log('\nInput');
  console.log(`- Subject/subtopic: ${session.subject} / ${session.subtopic}`);
  console.log(`- Intent prompts: qa, summarize, memorables, flashcards, ambiguous`);

  console.log('\nIntent dispatch results');
  console.log(`- Explain the Calvin cycle. -> ${qa.intent}`);
  console.log(`- Summarize this session. -> ${summary.intent}`);
  console.log(`- Give me the key things to remember from this topic. -> ${memorables.intent}`);
  console.log(`- Make flashcards from this. -> ${flashcards.intent}`);
  console.log(`- Can you help with this topic? -> ${ambiguous.intent}`);
  console.log(`- Rolling summary length after mixed intents: ${rollingSum.length}`);

  console.log('\n✓ Phase 8.5 intent-routing test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
