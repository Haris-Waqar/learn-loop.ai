/**
 * CompressorChain
 * Purpose: Compress a list of messages into a 2–3 sentence summary chunk.
 * Input: { messages: Message[] }
 * Output: { summaryChunk: string }
 * LangChain concepts: LLMChain, ChatPromptTemplate
 * Note: Runs automatically when token threshold (60%) is crossed. Output is
 *       appended to rollingSum; compressed messages are removed from recentMessages.
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent } from '@/lib/utils/responseParser';
import type { Message } from '@/types/session';

function formatMessages(messages: Message[]): string {
  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
}

export async function runCompressorChain(input: {
  messages: Message[];
}): Promise<{ summaryChunk: string }> {
  const messages = input.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AppError('Messages are required to create a summary chunk.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `Compress the conversation into 2 to 3 sentences.

Requirements:
- Preserve the key facts, questions asked, and any direct conclusions.
- Keep it useful as rolling study context for a future LLM call.
- Do not write bullets or headings.
- Do not invent details that were not discussed.`,
    ],
    [
      'human',
      'Messages to compress:\n{messages}',
    ],
  ]);

  const response = await prompt.pipe(llm).invoke({
    messages: formatMessages(messages),
  });
  const summaryChunk = getTextContent(response.content).replace(/\s+/g, ' ').trim();

  if (summaryChunk.length === 0) {
    throw new AppError('CompressorChain returned an empty summary.', 500);
  }

  return { summaryChunk };
}
