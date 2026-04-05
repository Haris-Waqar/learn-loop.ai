import { ChatOpenAI } from '@langchain/openai';
import { LLM_MODEL } from '@/lib/constants';

/**
 * Shared ChatOpenAI instance used by all chains.
 * Never instantiate ChatOpenAI directly inside a chain file — import this instead.
 */
export const llm = new ChatOpenAI({
  modelName: LLM_MODEL,
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * Streaming variant for routes that need to stream responses (e.g. SummaryChain).
 */
export const llmStream = new ChatOpenAI({
  modelName: LLM_MODEL,
  temperature: 0.3,
  streaming: true,
  openAIApiKey: process.env.OPENAI_API_KEY,
});
