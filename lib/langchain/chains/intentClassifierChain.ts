/**
 * IntentClassifierChain
 * Purpose: Detect which study-mode action a normal chat prompt is asking for.
 * Input: { userMessage, currentSubject, currentSubtopic, recentMessages }
 * Output: { intent, confidence }
 * LangChain concepts: LLMChain, ChatPromptTemplate, JSON parsing
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent, parseJsonResponse } from '@/lib/utils/responseParser';
import type { IntentClassificationResult, Message, StudyIntent } from '@/types/session';

function formatMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return 'No recent conversation yet.';
  }

  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
}

const VALID_INTENTS: StudyIntent[] = ['qa', 'summarize', 'memorables', 'flashcards'];
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high']);

export async function runIntentClassifierChain(input: {
  userMessage: string;
  currentSubject: string;
  currentSubtopic: string;
  recentMessages: Message[];
}): Promise<IntentClassificationResult> {
  const userMessage = input.userMessage.trim();
  const currentSubject = input.currentSubject.trim();
  const currentSubtopic = input.currentSubtopic.trim();

  if (userMessage.length === 0) {
    throw new AppError('User message is required to classify intent.', 400);
  }

  if (currentSubject.length === 0 || currentSubtopic.length === 0) {
    throw new AppError('Current subject and subtopic are required to classify intent.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You classify a learner's newest chat message into one study action.
Return JSON only with this exact shape:
{{
  "intent": "qa" | "summarize" | "memorables" | "flashcards",
  "confidence": "low" | "medium" | "high"
}}

Rules:
- "qa" means the user is asking for an explanation, answer, clarification, comparison, or follow-up discussion.
- "summarize" means they want a recap, summary, or overview of the session/material.
- "memorables" means they want key things to remember, key points, or high-yield takeaways.
- "flashcards" means they want study cards, quiz cards, or flashcards.
- Be conservative. If the request is ambiguous, return "qa".
- Do not include markdown fences or extra keys.`,
    ],
    [
      'human',
      `Current subject: {currentSubject}
Current subtopic: {currentSubtopic}
Recent conversation:
{recentMessages}

Newest user message:
{userMessage}`,
    ],
  ]);

  const response = await prompt.pipe(llm).invoke({
    userMessage,
    currentSubject,
    currentSubtopic,
    recentMessages: formatMessages(input.recentMessages),
  });

  const parsed = parseJsonResponse<Partial<IntentClassificationResult>>(getTextContent(response.content));
  const intent = parsed.intent;
  const confidence = parsed.confidence;

  if (!intent || !VALID_INTENTS.includes(intent)) {
    throw new AppError('IntentClassifierChain returned an invalid intent.', 500, { parsed });
  }

  if (!confidence || !VALID_CONFIDENCE.has(confidence)) {
    throw new AppError('IntentClassifierChain returned an invalid confidence.', 500, { parsed });
  }

  return {
    intent,
    confidence: confidence as IntentClassificationResult['confidence'],
  };
}
