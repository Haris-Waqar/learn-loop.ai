/**
 * HandoffChain
 * Purpose: Compress the full session into a 3–5 bullet handoff summary for the next session.
 * Input: { material, summary, recentMessages, rollingSum, persona }
 * Output: { handoffSummary: string }
 * LangChain concepts: LLMChain, ChatPromptTemplate
 * Note: Triggered on session end or when user starts a new chat after topic shift.
 */
import type { Message } from '@/types/session';

export async function runHandoffChain(_input: {
  material: string;
  summary: string | null;
  recentMessages: Message[];
  rollingSum: string;
  persona: string;
}): Promise<{ handoffSummary: string }> {
  // Phase 8 implementation
  throw new Error('HandoffChain not yet implemented');
}
