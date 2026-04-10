/**
 * HandoffChain
 * Purpose: Compress the full session into a 3–5 bullet handoff summary for the next session.
 * Input: { material, summary, recentMessages, rollingSum, persona }
 * Output: { handoffSummary: string }
 * LangChain concepts: LLMChain, ChatPromptTemplate
 * Note: Triggered on session end or when user starts a new chat after topic shift.
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { HANDOFF_BULLET_COUNT } from '@/lib/constants';
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

export async function runHandoffChain(input: {
  material: string;
  summary: string | null;
  recentMessages: Message[];
  rollingSum: string;
  persona: string;
}): Promise<{ handoffSummary: string }> {
  const material = input.material.trim();
  const persona = input.persona.trim();

  if (material.length === 0) {
    throw new AppError('Material is required to generate a handoff summary.', 400);
  }

  if (persona.length === 0) {
    throw new AppError('Persona is required to generate a handoff summary.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `Generate a session handoff summary for the learner's next study session.

Active persona:
{persona}

Requirements:
- Return ${HANDOFF_BULLET_COUNT.min} to ${HANDOFF_BULLET_COUNT.max} bullet points only.
- Keep the entire handoff under 200 words.
- Capture what was studied, what was clarified during the session, and what the next session should continue from.
- Stay faithful to the provided material and discussion.
- Do not include headings, numbering, or prose outside the bullets.`,
    ],
    [
      'human',
      `Original study material:
{material}

Current session summary:
{summary}

Rolling compressed context:
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

  const bullets = parseBulletList(getTextContent(response.content)).slice(0, HANDOFF_BULLET_COUNT.max);

  if (bullets.length < HANDOFF_BULLET_COUNT.min) {
    throw new AppError('HandoffChain returned too few handoff bullets.', 500, { bullets });
  }

  const handoffSummary = bullets.map((bullet) => `- ${bullet}`).join('\n');
  const wordCount = handoffSummary.split(/\s+/).filter(Boolean).length;

  if (wordCount > 200) {
    throw new AppError('HandoffChain returned a handoff summary longer than 200 words.', 500, {
      wordCount,
    });
  }

  return { handoffSummary };
}
