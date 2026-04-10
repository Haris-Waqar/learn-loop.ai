/**
 * Phase 3 test: verify summary streaming, final summary assembly,
 * and input validation for the summarize route.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-summary.ts
 */
import * as dotenv from 'dotenv';
import Module from 'module';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { parseBulletList } from '../lib/utils/responseParser';

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
Photosynthesis converts light energy into chemical energy through reactions that begin in the chloroplasts.
The light-dependent reactions generate ATP and NADPH, while the Calvin cycle uses those products to fix carbon dioxide into sugars.
We also reviewed why chlorophyll absorbs red and blue wavelengths most effectively and how stomata regulate gas exchange in plant leaves.
Finally, the lesson compared photosynthesis with cellular respiration to explain how matter cycles and energy flows through living systems.
`;

const persona = `You are a senior biology educator who explains concepts clearly, connects mechanisms to big-picture meaning, and highlights what students are most likely to be tested on.`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

interface ParsedSseEvent {
  event: string;
  data: string;
}

function parseSseBuffer(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
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
        data: JSON.parse(dataLine) as string,
      };
    })
    .filter((value): value is ParsedSseEvent => value !== null);

  return { events, remainder };
}

async function collectSseEvents(response: Response): Promise<ParsedSseEvent[]> {
  assert(response.body, 'Expected summarize route to return a readable stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: ParsedSseEvent[] = [];
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    events.push(...parsed.events);
    buffer = parsed.remainder;
  }

  buffer += decoder.decode();
  const parsed = parseSseBuffer(`${buffer}\n\n`);
  events.push(...parsed.events);

  return events;
}

async function main() {
  const { POST } = (await import('../app/api/session/summarize/route')) as typeof import('../app/api/session/summarize/route');

  const request = new Request('http://localhost/api/session/summarize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ material, persona }),
  });

  const response = await POST(request);
  assert(response.ok, `Summarize request failed with status ${response.status}.`);
  assert(
    response.headers.get('content-type')?.startsWith('text/event-stream'),
    'Expected text/event-stream content type.',
  );

  const events = await collectSseEvents(response);
  const thinkingEvents = events.filter((event) => event.event === 'thinking');
  const chunkEvents = events.filter((event) => event.event === 'chunk');
  const completeEvent = events.find((event) => event.event === 'complete');
  const errorEvent = events.find((event) => event.event === 'error');

  assert(!errorEvent, `Unexpected SSE error event: ${errorEvent?.data ?? 'unknown error'}`);
  assert(thinkingEvents.length > 0, 'Expected at least one thinking event before completion.');
  assert(chunkEvents.length > 0, 'Expected at least one chunk event before completion.');
  assert(completeEvent, 'Expected a complete event.');
  assert(
    events.findIndex((event) => event.event === 'thinking') < events.findIndex((event) => event.event === 'complete'),
    'Expected thinking events to arrive before the complete event.',
  );
  assert(
    thinkingEvents.some((event) => event.data === 'Preparing a summary' || event.data === 'Generating your summary'),
    'Expected user-centric summary thinking events.',
  );

  const summary = completeEvent.data;
  const bullets = parseBulletList(summary);

  assert(bullets.length >= 5 && bullets.length <= 8, `Expected 5-8 bullets, received ${bullets.length}.`);

  console.log('\nSSE event counts');
  console.log(`- thinking: ${thinkingEvents.length}`);
  console.log(`- chunk: ${chunkEvents.length}`);
  console.log(`- complete: ${completeEvent ? 1 : 0}`);

  console.log('\nThinking events');
  thinkingEvents.forEach((event, index) => {
    console.log(`- ${index + 1}. ${event.data}`);
  });

  console.log('\nFinal summary');
  console.log(summary);

  const invalidRequest = new Request('http://localhost/api/session/summarize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ material: '   ', persona }),
  });

  const invalidResponse = await POST(invalidRequest);
  assert(invalidResponse.status === 400, `Expected 400 for empty material, received ${invalidResponse.status}.`);

  console.log('\n✓ Phase 3 summary streaming test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
