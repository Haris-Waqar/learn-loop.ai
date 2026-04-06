/**
 * MemorableChain
 * Purpose: Extract 5–7 must-remember key points, context-aware of the full session.
 * Input: { material, summary, recentMessages, rollingSum, persona }
 * Output: { memorables: string[] }
 * LangChain concepts: LLMChain, ChatPromptTemplate
 */
import type { Message } from '@/types/session';

export async function runMemorableChain(_input: {
  material: string;
  summary: string | null;
  recentMessages: Message[];
  rollingSum: string;
  persona: string;
}): Promise<{ memorables: string[] }> {
  // Phase 7 implementation
  throw new Error('MemorableChain not yet implemented');
}
