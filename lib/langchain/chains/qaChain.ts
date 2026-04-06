/**
 * QAChain
 * Purpose: Answer a user question using RAG (top 3 retrieved chunks) + conversation history.
 * Input: { question, persona, recentMessages, rollingSum, serializedVectors }
 * Output: { answer: string; updatedMessages: Message[] }
 * LangChain concepts: LLMChain, ChatPromptTemplate, DocArrayInMemorySearch, similarity search
 */
import type { Message, SerializedVector } from '@/types/session';

export async function runQAChain(_input: {
  question: string;
  persona: string;
  recentMessages: Message[];
  rollingSum: string;
  serializedVectors: SerializedVector[];
}): Promise<{ answer: string; updatedMessages: Message[] }> {
  // Phase 4 implementation
  throw new Error('QAChain not yet implemented');
}
