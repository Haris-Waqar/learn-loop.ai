/**
 * Phase 7 test: verify structured flashcard generation from session context.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-flashcards.ts
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

const memorables = [
  'Light-dependent reactions produce ATP and NADPH.',
  'The Calvin cycle fixes carbon dioxide into sugars.',
  'Chlorophyll absorbs red and blue light most effectively.',
  'Stomata regulate gas exchange in leaves.',
  'Photosynthesis converts light energy into chemical energy.',
];

const recentMessages: Message[] = [
  { role: 'user', content: 'What is the difference between the two stages?', timestamp: Date.now() },
  {
    role: 'assistant',
    content: 'The first captures light energy, while the Calvin cycle uses that energy to build sugars.',
    type: 'answer',
    timestamp: Date.now() + 1,
  },
];

async function main() {
  const { POST } = (await import('../app/api/session/flashcards/route')) as typeof import('../app/api/session/flashcards/route');

  const response = await POST(
    new Request('http://localhost/api/session/flashcards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        material,
        summary: '- Photosynthesis has two main stages.\n- The Calvin cycle uses ATP and NADPH.',
        memorables,
        recentMessages,
        rollingSum: 'We already discussed the relationship between ATP, NADPH, and carbon fixation.',
        persona:
          'You are a biology tutor who creates concise, revision-friendly flashcards grounded in source material.',
      }),
    }),
  );

  const json = (await response.json()) as {
    success: boolean;
    data?: { flashcards: { front: string; back: string }[] };
    error?: string;
  };

  assert(response.ok, `Flashcards route failed: ${json.error ?? 'unknown error'}`);
  assert(json.success && json.data, 'Expected flashcards data.');
  assert(json.data.flashcards.length >= 5 && json.data.flashcards.length <= 10, 'Expected 5-10 flashcards.');
  assert(
    json.data.flashcards.every((card) => card.front.trim().length > 0 && card.back.trim().length > 0),
    'Each flashcard must have non-empty front and back text.',
  );

  console.log('\nInput');
  console.log(`- Material preview: ${material.trim().slice(0, 140)}...`);
  console.log(`- Memorables count: ${memorables.length}`);
  console.log(`- Recent messages: ${recentMessages.length}`);
  console.log(`- Summary preview: - Photosynthesis has two main stages. - The Calvin cycle uses ATP and NADPH.`);

  console.log('\nFlashcards');
  json.data.flashcards.slice(0, 3).forEach((card, index) => {
    console.log(`- Card ${index + 1} front: ${card.front}`);
    console.log(`  back: ${card.back}`);
  });
  console.log('\n✓ Phase 7 flashcards test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
