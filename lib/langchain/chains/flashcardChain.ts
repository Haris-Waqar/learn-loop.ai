/**
 * FlashcardChain
 * Purpose: Generate 5–10 flashcards as structured JSON, context-aware of the full session.
 * Input: { material, summary, memorables, recentMessages, rollingSum, persona }
 * Output: { flashcards: Flashcard[] }
 * LangChain concepts: LLMChain, ChatPromptTemplate, StructuredOutputParser, ResponseSchema
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

import { FLASHCARD_COUNT } from '@/lib/constants';
import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent } from '@/lib/utils/responseParser';
import type { Flashcard, Message } from '@/types/session';

function formatMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return 'No recent conversation yet.';
  }

  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
}

// Keep the parser runtime-validated while avoiding a TypeScript deep-instantiation blow-up.
const flashcardSchema = z.object({
  flashcards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
      }),
    )
    .min(FLASHCARD_COUNT.min)
    .max(FLASHCARD_COUNT.max),
}) as z.ZodTypeAny;

const flashcardParser = (
  StructuredOutputParser as unknown as {
    fromZodSchema(schema: z.ZodTypeAny): {
      getFormatInstructions(): string;
      parse(text: string): Promise<unknown>;
    };
  }
).fromZodSchema(flashcardSchema);

export async function runFlashcardChain(input: {
  material: string;
  summary: string | null;
  memorables: string[];
  recentMessages: Message[];
  rollingSum: string;
  persona: string;
}): Promise<{ flashcards: Flashcard[] }> {
  const material = input.material.trim();
  const persona = input.persona.trim();

  if (material.length === 0) {
    throw new AppError('Material is required to generate flashcards.', 400);
  }

  if (persona.length === 0) {
    throw new AppError('Persona is required to generate flashcards.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `Generate study flashcards from the full session context.

Active persona:
{persona}

Requirements:
- Produce ${FLASHCARD_COUNT.min} to ${FLASHCARD_COUNT.max} flashcards.
- Each flashcard must be useful for revision, not trivia.
- Prefer concepts, mechanisms, contrasts, and cause-effect relationships.
- Avoid near-duplicate cards.
- {formatInstructions}`,
    ],
    [
      'human',
      `Study material:
{material}

Existing summary:
{summary}

Memorables:
{memorables}

Rolling context:
{rollingSum}

Recent conversation:
{recentMessages}`,
    ],
  ]);

  const response = await prompt.pipe(llm).invoke({
    material,
    summary: input.summary?.trim() || 'No summary generated yet.',
    memorables: input.memorables.length > 0 ? input.memorables.join('\n') : 'No memorables generated yet.',
    rollingSum: input.rollingSum.trim() || 'No rolling summary yet.',
    recentMessages: formatMessages(input.recentMessages),
    persona,
    formatInstructions: flashcardParser.getFormatInstructions(),
  });

  const parsed = await flashcardParser.parse(getTextContent(response.content));
  const flashcards = ((parsed as { flashcards?: unknown }).flashcards ?? []) as Flashcard[];

  const validFlashcards = flashcards.filter(
    (card) =>
      card &&
      typeof card.front === 'string' &&
      typeof card.back === 'string' &&
      card.front.trim().length > 0 &&
      card.back.trim().length > 0,
  );

  if (
    validFlashcards.length < FLASHCARD_COUNT.min ||
    validFlashcards.length > FLASHCARD_COUNT.max
  ) {
    throw new AppError('FlashcardChain returned an invalid number of flashcards.', 500, {
      count: validFlashcards.length,
    });
  }

  return {
    flashcards: validFlashcards.map((card) => ({
      front: card.front.trim(),
      back: card.back.trim(),
    })),
  };
}
