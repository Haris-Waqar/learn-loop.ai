/**
 * Phase 8 test: verify session handoff summary generation.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-handoff.ts
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
  {
    role: 'user',
    content: 'What should I focus on next time?',
    timestamp: Date.now() + 2,
  },
];

async function main() {
  const { POST } = (await import('../app/api/session/handoff/route')) as typeof import('../app/api/session/handoff/route');

  const response = await POST(
    new Request('http://localhost/api/session/handoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        material,
        summary:
          '- Photosynthesis has light-dependent reactions and the Calvin cycle.\n- ATP and NADPH power carbon fixation.',
        recentMessages,
        rollingSum: 'We clarified that the Calvin cycle uses ATP and NADPH to build sugars from carbon dioxide.',
        persona:
          'You are a biology tutor who writes concise study handoffs for the next revision session.',
      }),
    }),
  );

  const json = (await response.json()) as {
    success: boolean;
    data?: { handoffSummary: string };
    error?: string;
  };

  assert(response.ok, `Handoff route failed: ${json.error ?? 'unknown error'}`);
  assert(json.success && json.data, 'Expected handoff data.');

  const bullets = json.data.handoffSummary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
  const wordCount = json.data.handoffSummary.split(/\s+/).filter(Boolean).length;

  assert(bullets.length >= 3 && bullets.length <= 5, 'Expected 3-5 handoff bullets.');
  assert(wordCount < 200, 'Expected handoff summary under 200 words.');
  assert(
    /photosynthesis|Calvin cycle|ATP|NADPH/i.test(json.data.handoffSummary),
    'Handoff summary should reference the studied topic and prior Q&A context.',
  );

  console.log('\nInput');
  console.log(`- Material preview: ${material.trim().slice(0, 140)}...`);
  console.log(`- Summary preview: - Photosynthesis has light-dependent reactions and the Calvin cycle.`);
  console.log(`- Recent messages: ${recentMessages.length}`);

  console.log('\nHandoff summary');
  console.log(json.data.handoffSummary);
  console.log(`\n- Bullet count: ${bullets.length}`);
  console.log(`- Word count: ${wordCount}`);

  const invalidResponse = await POST(
    new Request('http://localhost/api/session/handoff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        material: '   ',
        summary: null,
        recentMessages: [],
        rollingSum: '',
        persona: '',
      }),
    }),
  );
  assert(invalidResponse.status === 400, `Expected 400 for invalid handoff payload, received ${invalidResponse.status}.`);

  console.log('\n✓ Phase 8 handoff test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
