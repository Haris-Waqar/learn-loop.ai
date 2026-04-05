/**
 * TopicShiftChain
 * Purpose: Silently detect if the user's message shifts to a different academic subject.
 * Input: { currentSubject, currentSubtopic, userMessage }
 * Output: TopicShiftResult { shifted: boolean; newSubject: string | null }
 * LangChain concepts: LLMChain, ChatPromptTemplate, StructuredOutputParser
 * Note: Runs in parallel with QAChain on every Q&A message.
 */
import type { TopicShiftResult } from '@/types/session';

export async function runTopicShiftChain(_input: {
  currentSubject: string;
  currentSubtopic: string;
  userMessage: string;
}): Promise<TopicShiftResult> {
  // Phase 5 implementation
  throw new Error('TopicShiftChain not yet implemented');
}
