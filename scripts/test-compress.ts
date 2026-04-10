/**
 * Phase 6 test: verify standalone compression and automatic compression
 * inside the ask route when token thresholds are crossed.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-compress.ts
 */
import * as dotenv from 'dotenv';
import Module from 'module';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import type { Message } from '../types/session';

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

const messages: Message[] = Array.from({ length: 8 }, (_, index) => ({
  role: index % 2 === 0 ? 'user' : 'assistant',
  content: `Message ${index + 1}: ${'photosynthesis and energy transfer '.repeat(120)}`,
  timestamp: Date.now() + index,
  ...(index % 2 === 1 ? { type: 'answer' as const } : {}),
}));

async function main() {
  const { POST: compressPOST } = (await import('../app/api/session/compress/route')) as typeof import('../app/api/session/compress/route');
  const { POST: askPOST } = (await import('../app/api/session/ask/route')) as typeof import('../app/api/session/ask/route');

  const compressResponse = await compressPOST(
    new Request('http://localhost/api/session/compress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    }),
  );
  const compressJson = (await compressResponse.json()) as {
    success: boolean;
    data?: { summaryChunk: string };
    error?: string;
  };

  assert(compressResponse.ok, `Compress route failed: ${compressJson.error ?? 'unknown error'}`);
  assert(compressJson.success && compressJson.data, 'Expected summaryChunk from compress route.');
  assert(compressJson.data.summaryChunk.length < messages.map((message) => message.content).join(' ').length, 'Compressed output should be shorter than input.');

  const askResponse = await askPOST(
    new Request('http://localhost/api/session/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: 'What is the main purpose of photosynthesis?',
        material:
          'Photosynthesis captures light energy, produces ATP and NADPH, and uses the Calvin cycle to fix carbon dioxide into sugars.',
        summary: null,
        memorables: [],
        persona:
          'You are a biology tutor who gives concise, exam-ready explanations and stays grounded in the study material.',
        currentSubject: 'Biology',
        currentSubtopic: 'Photosynthesis',
        recentMessages: messages,
        rollingSum: '',
        serializedVectors: [
          {
            pageContent:
              'Photosynthesis captures light energy, produces ATP and NADPH, and then fixes carbon dioxide into sugars.',
            metadata: { source: 'test', chunkIndex: 0 },
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      }),
    }),
  );

  assert(askResponse.ok, `Ask route failed with status ${askResponse.status}.`);
  const text = await askResponse.text();
  const completeDataRaw = text
    .split('\n\n')
    .find((block) => block.startsWith('event: complete'));
  assert(completeDataRaw, 'Expected complete event from ask route.');
  const completeDataLine = completeDataRaw
    .split('\n')
    .find((line) => line.startsWith('data: '));
  assert(completeDataLine, 'Expected data line in complete event.');
  const complete = JSON.parse(completeDataLine.slice(6)) as {
    updatedMessages: Message[];
    rollingSum: string;
    compressionApplied: boolean;
    shouldWarn: boolean;
  };

  assert(complete.compressionApplied === true, 'Expected ask route to auto-compress when token threshold is crossed.');
  assert(complete.rollingSum.length > 0, 'Expected rollingSum to be updated after compression.');
  assert(complete.updatedMessages.length < messages.length + 2, 'Expected some old messages to be removed after compression.');

  console.log('\nInput');
  console.log(`- Standalone compress message count: ${messages.length}`);
  console.log(`- Sample message preview: ${messages[0]?.content.slice(0, 100)}...`);
  console.log(`- Ask route question: What is the main purpose of photosynthesis?`);
  console.log(`- Ask route subject/subtopic: Biology / Photosynthesis`);

  console.log('\nCompression results');
  console.log(`- Standalone summary length: ${compressJson.data.summaryChunk.length}`);
  console.log(`- Standalone summary preview: ${compressJson.data.summaryChunk.slice(0, 160)}...`);
  console.log(`- Auto-compression applied: ${complete.compressionApplied}`);
  console.log(`- Remaining messages: ${complete.updatedMessages.length}`);
  console.log(`- Rolling summary preview: ${complete.rollingSum.slice(0, 160)}...`);
  console.log('\n✓ Phase 6 compression test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
