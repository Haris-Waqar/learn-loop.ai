/**
 * Phase 1 test: confirm LangChain + OpenAI API key are wired up correctly.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/test-llm.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LLM_MODEL } from '../lib/constants';

async function main() {
  console.log(`Testing LLM connection with model: ${LLM_MODEL}`);

  const llm = new ChatOpenAI({
    modelName: LLM_MODEL,
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant. Answer in one sentence.'],
    ['human', '{input}'],
  ]);

  const chain = prompt.pipe(llm);
  const result = await chain.invoke({ input: 'What is photosynthesis?' });

  console.log('\n✓ LLM response received:');
  console.log(result.content);
  console.log('\n✓ Phase 1 LLM connectivity test passed.');
}

main().catch((err) => {
  console.error('✗ Test failed:', err);
  process.exit(1);
});
