/**
 * Phase 7 test: verify memorable-point generation from full session context.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-memorables.ts
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

const material = `
Photosynthesis occurs in chloroplasts. Light-dependent reactions produce ATP and NADPH.
The Calvin cycle uses those molecules to fix carbon dioxide into sugars.
Chlorophyll absorbs red and blue wavelengths efficiently, and stomata regulate gas exchange.
`;

const recentMessages: Message[] = [
  { role: 'user', content: 'What does the Calvin cycle do?', timestamp: Date.now() },
  {
    role: 'assistant',
    content: 'It uses ATP and NADPH to fix carbon dioxide into sugars.',
    type: 'answer',
    timestamp: Date.now() + 1,
  },
];

async function main() {
  const { POST } = (await import('../app/api/session/memorables/route')) as typeof import('../app/api/session/memorables/route');

  const response = await POST(
    new Request('http://localhost/api/session/memorables', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        material,
        summary: null,
        recentMessages,
        rollingSum: 'Earlier we contrasted light-dependent reactions with the Calvin cycle.',
        persona:
          'You are a biology tutor who highlights the highest-yield facts students should remember for exams.',
      }),
    }),
  );

  const json = (await response.json()) as {
    success: boolean;
    data?: { memorables: string[] };
    error?: string;
  };

  assert(response.ok, `Memorables route failed: ${json.error ?? 'unknown error'}`);
  assert(json.success && json.data, 'Expected memorables data.');
  assert(json.data.memorables.length >= 5 && json.data.memorables.length <= 7, 'Expected 5-7 memorables.');
  assert(new Set(json.data.memorables).size === json.data.memorables.length, 'Memorables should be distinct.');

  console.log('\nInput');
  console.log(`- Material preview: ${material.trim().slice(0, 140)}...`);
  console.log(`- Summary: null`);
  console.log(`- Recent messages: ${recentMessages.length}`);
  console.log(`- Rolling summary: Earlier we contrasted light-dependent reactions with the Calvin cycle.`);

  console.log('\nMemorables');
  json.data.memorables.forEach((item, index) => console.log(`- ${index + 1}. ${item}`));
  console.log('\n✓ Phase 7 memorables test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
