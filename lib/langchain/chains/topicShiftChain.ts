/**
 * TopicShiftChain
 * Purpose: Silently detect if the user's message shifts to a different academic subject.
 * Input: { currentSubject, currentSubtopic, userMessage }
 * Output: TopicShiftResult { shifted: boolean; newSubject: string | null }
 * LangChain concepts: LLMChain, ChatPromptTemplate, StructuredOutputParser
 * Note: Runs in parallel with QAChain on every Q&A message.
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent, parseJsonResponse } from '@/lib/utils/responseParser';
import type { TopicShiftResult } from '@/types/session';

export async function runTopicShiftChain(input: {
  currentSubject: string;
  currentSubtopic: string;
  userMessage: string;
}): Promise<TopicShiftResult> {
  const currentSubject = input.currentSubject.trim();
  const currentSubtopic = input.currentSubtopic.trim();
  const userMessage = input.userMessage.trim();

  if (currentSubject.length === 0 || currentSubtopic.length === 0 || userMessage.length === 0) {
    throw new AppError('Current subject, subtopic, and user message are required for topic-shift detection.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You detect whether a student's newest message has clearly moved to a different academic subject.
Return JSON only with this exact shape:
{{
  "shifted": boolean,
  "newSubject": string | null
}}

Rules:
- Be conservative. Follow-up questions, clarifications, or narrower subtopic changes are NOT a topic shift.
- Only return "shifted": true when the user has clearly moved to a different academic subject.
- If shifted is false, newSubject must be null.
- If shifted is true, newSubject must be a concise subject label.
- Do not include markdown fences or extra keys.`,
    ],
    [
      'human',
      `Current subject: {currentSubject}
Current subtopic: {currentSubtopic}
New user message: {userMessage}`,
    ],
  ]);

  const response = await prompt.pipe(llm).invoke({
    currentSubject,
    currentSubtopic,
    userMessage,
  });
  const parsed = parseJsonResponse<Partial<TopicShiftResult>>(getTextContent(response.content));

  const shifted = parsed.shifted;
  const newSubject =
    typeof parsed.newSubject === 'string' && parsed.newSubject.trim().length > 0
      ? parsed.newSubject.trim()
      : null;

  if (typeof shifted !== 'boolean') {
    throw new AppError('TopicShiftChain returned invalid output.', 500, { parsed });
  }

  if (!shifted) {
    return { shifted: false, newSubject: null };
  }

  if (!newSubject) {
    throw new AppError('TopicShiftChain marked a shift without a new subject.', 500, { parsed });
  }

  return { shifted: true, newSubject };
}
