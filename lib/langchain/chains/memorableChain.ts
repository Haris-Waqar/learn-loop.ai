/**
 * MemorableChain
 * Purpose: Extract 5–7 must-remember key points, context-aware of the full session.
 * Input: { material, summary, recentMessages, rollingSum, persona }
 * Output: { memorables: string[] }
 * LangChain concepts: LLMChain, ChatPromptTemplate
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { MEMORABLE_COUNT } from '@/lib/constants';
import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent, parseBulletList } from '@/lib/utils/responseParser';
import type { Message } from '@/types/session';

function formatMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return 'No recent conversation yet.';
  }

  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
}

export async function runMemorableChain(input: {
  material: string;
  summary: string | null;
  recentMessages: Message[];
  rollingSum: string;
  persona: string;
}): Promise<{ memorables: string[] }> {
  const material = input.material.trim();
  const persona = input.persona.trim();

  if (material.length === 0) {
    throw new AppError('Material is required to generate memorables.', 400);
  }

  if (persona.length === 0) {
    throw new AppError('Persona is required to generate memorables.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `Extract ${MEMORABLE_COUNT.min} to ${MEMORABLE_COUNT.max} must-remember study points.

Active persona:
{persona}

Requirements:
- Return plain bullet points only.
- Each bullet must capture a distinct idea worth revising.
- Use the study material plus session context.
- Prioritize high-value concepts, mechanisms, contrasts, and definitions.
- Do not repeat the same idea with different wording.`,
    ],
    [
      'human',
      `Study material:
{material}

Existing summary:
{summary}

Rolling context:
{rollingSum}

Recent conversation:
{recentMessages}`,
    ],
  ]);

  const response = await prompt.pipe(llm).invoke({
    material,
    summary: input.summary?.trim() || 'No summary generated yet.',
    rollingSum: input.rollingSum.trim() || 'No rolling summary yet.',
    recentMessages: formatMessages(input.recentMessages),
    persona,
  });

  const memorables = parseBulletList(getTextContent(response.content)).slice(0, MEMORABLE_COUNT.max);

  if (memorables.length < MEMORABLE_COUNT.min) {
    throw new AppError('MemorableChain returned too few memorable points.', 500, { memorables });
  }

  return { memorables };
}
