/**
 * Phase 4 test: verify retrieval-backed Q&A streaming, updated message state,
 * and source-chunk relevance.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-qa.ts
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
The Calvin cycle uses ATP and NADPH to fix carbon dioxide into sugars that the plant can use for growth and storage.
Chlorophyll absorbs red and blue wavelengths especially well, which is why green light is reflected more than it is absorbed.
Stomata regulate gas exchange by allowing carbon dioxide to enter the leaf while oxygen and water vapor leave.
Comparing photosynthesis with cellular respiration helps explain how energy is transformed and how matter cycles through living systems.
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

interface QACompleteEvent {
  answer: string;
  updatedMessages: Message[];
  tokenCount: number;
  retrievedChunks: { pageContent: string; metadata: Record<string, unknown> }[];
  topicShift: { shifted: boolean; newSubject: string | null };
  rollingSum: string;
  compressionApplied: boolean;
  shouldWarn: boolean;
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

      return {
        event,
        data: JSON.parse(dataLine) as T,
      };
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
): Promise<{ chunkCount: number; complete: QACompleteEvent }> {
  const response = await postRoute(
    new Request('http://localhost/api/session/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );

  assert(response.ok, `Ask route failed with status ${response.status}.`);
  assert(
    response.headers.get('content-type')?.startsWith('text/event-stream'),
    'Expected text/event-stream content type.',
  );

  const events = await collectSseEvents<string | QACompleteEvent>(response);
  const chunkEvents = events.filter((event) => event.event === 'chunk');
  const completeEvent = events.find((event) => event.event === 'complete');
  const errorEvent = events.find((event) => event.event === 'error');

  assert(!errorEvent, `Unexpected SSE error event: ${String(errorEvent?.data ?? 'unknown error')}`);
  assert(chunkEvents.length > 0, 'Expected at least one answer chunk.');
  assert(completeEvent, 'Expected a complete event.');

  return {
    chunkCount: chunkEvents.length,
    complete: completeEvent.data as QACompleteEvent,
  };
}

async function main() {
  const { POST: startPOST } = (await import('../app/api/session/start/route')) as typeof import('../app/api/session/start/route');
  const { POST: askPOST } = (await import('../app/api/session/ask/route')) as typeof import('../app/api/session/ask/route');

  const session = await startSession(startPOST);
  let recentMessages = session.recentMessages;

  const first = await askQuestion(askPOST, {
    question: 'What are the two main stages of photosynthesis?',
    persona: session.persona,
    currentSubject: session.subject,
    currentSubtopic: session.subtopic,
    recentMessages,
    rollingSum: session.rollingSum,
    serializedVectors: session.serializedVectors,
  });
  recentMessages = first.complete.updatedMessages;

  assert(/light-dependent/i.test(first.complete.answer), 'First answer should mention the light-dependent reactions.');
  assert(/Calvin cycle/i.test(first.complete.answer), 'First answer should mention the Calvin cycle.');

  const second = await askQuestion(askPOST, {
    question: 'Which stage uses ATP and NADPH from the first stage?',
    persona: session.persona,
    currentSubject: session.subject,
    currentSubtopic: session.subtopic,
    recentMessages,
    rollingSum: first.complete.rollingSum,
    serializedVectors: session.serializedVectors,
  });
  recentMessages = second.complete.updatedMessages;

  assert(/Calvin cycle/i.test(second.complete.answer), 'Second answer should identify the Calvin cycle.');
  assert(/ATP/i.test(second.complete.answer) || /NADPH/i.test(second.complete.answer), 'Second answer should reference ATP or NADPH.');

  const third = await askQuestion(askPOST, {
    question: 'Give me a simpler comparison between those two stages.',
    persona: session.persona,
    currentSubject: session.subject,
    currentSubtopic: session.subtopic,
    recentMessages,
    rollingSum: second.complete.rollingSum,
    serializedVectors: session.serializedVectors,
  });

  assert(
    /light-dependent/i.test(third.complete.answer) || /Calvin cycle/i.test(third.complete.answer),
    'Third answer should still reference the earlier conversation context.',
  );
  assert(third.complete.updatedMessages.length <= 6, 'updatedMessages should be trimmed to MAX_RECENT_MESSAGES.');
  assert(third.complete.tokenCount > session.tokenCount, 'tokenCount should increase after multiple answers.');
  assert(third.complete.retrievedChunks.length > 0, 'Expected retrieved chunks in the complete event.');
  assert(third.complete.topicShift.shifted === false, 'On-topic Q&A should not trigger a topic shift.');

  const retrievedText = third.complete.retrievedChunks.map((chunk) => chunk.pageContent).join('\n');
  assert(/photosynthesis|Calvin cycle|ATP|NADPH/i.test(retrievedText), 'Retrieved chunks should be relevant to the source material.');

  console.log('\nInput');
  console.log(`- Material preview: ${material.trim().slice(0, 140)}...`);
  console.log(`- Session subject/subtopic: ${session.subject} / ${session.subtopic}`);
  console.log(`- Question 1: What are the two main stages of photosynthesis?`);
  console.log(`- Question 2: Which stage uses ATP and NADPH from the first stage?`);
  console.log(`- Question 3: Give me a simpler comparison between those two stages.`);

  console.log('\nQ&A stream results');
  console.log(`- Question 1 chunks: ${first.chunkCount}`);
  console.log(`- Question 2 chunks: ${second.chunkCount}`);
  console.log(`- Question 3 chunks: ${third.chunkCount}`);
  console.log(`- Final answer preview: ${third.complete.answer.slice(0, 180)}...`);
  console.log(`- Final token count: ${third.complete.tokenCount}`);
  console.log(`- Topic shift detected: ${third.complete.topicShift.shifted}`);
  console.log(`- Compression applied: ${third.complete.compressionApplied}`);

  console.log('\nRetrieved chunks from final answer');
  third.complete.retrievedChunks.forEach((chunk, index) => {
    console.log(`- Chunk ${index + 1}: ${chunk.pageContent}`);
  });

  const invalidResponse = await askPOST(
    new Request('http://localhost/api/session/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: '   ',
        persona: session.persona,
        currentSubject: session.subject,
        currentSubtopic: session.subtopic,
        recentMessages: [],
        rollingSum: '',
        serializedVectors: session.serializedVectors,
      }),
    }),
  );
  assert(invalidResponse.status === 400, `Expected 400 for empty question, received ${invalidResponse.status}.`);

  console.log('\n✓ Phase 4 Q&A streaming test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
