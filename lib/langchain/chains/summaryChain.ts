/**
 * SummaryChain
 * Purpose: Summarize study material into 5–8 bullet points, shaped by the active persona.
 * Input: { material: string; persona: string }
 * Output: { summary: string }
 * LangChain concepts: LLMChain, ChatPromptTemplate, streaming
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { SUMMARY_BULLET_COUNT } from '@/lib/constants';
import { llmStream } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';

interface SummaryChainInput {
  material: string;
  persona: string;
}

export function createSummaryPrompt() {
  return ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are generating study notes for a learner.

Active persona:
{persona}

Requirements:
- Summarize the material into ${SUMMARY_BULLET_COUNT.min} to ${SUMMARY_BULLET_COUNT.max} bullet points.
- Return plain bullet text only.
- Each bullet should capture a distinct idea worth remembering.
- Keep the wording clear, compact, and faithful to the source material.
- Let the persona shape the tone and framing, but do not invent facts.`,
    ],
    [
      'human',
      'Study material:\n\n{material}',
    ],
  ]);
}

function extractChunkText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          'text' in part &&
          (part as { type?: string }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }

        return '';
      })
      .join('');
  }

  return '';
}

export async function streamSummaryText(input: SummaryChainInput): Promise<AsyncIterable<string>> {
  const material = input.material.trim();
  const persona = input.persona.trim();

  if (material.length === 0) {
    throw new AppError('Material is required to generate a summary.', 400);
  }

  if (persona.length === 0) {
    throw new AppError('Persona is required to generate a summary.', 400);
  }

  const stream = await createSummaryPrompt().pipe(llmStream).stream({ material, persona });

  async function* textStream() {
    for await (const chunk of stream) {
      const text = extractChunkText(chunk.content);
      if (text.length > 0) {
        yield text;
      }
    }
  }

  return textStream();
}

export async function runSummaryChain(input: {
  material: string;
  persona: string;
}): Promise<{ summary: string }> {
  // Keep the chain reusable in scripts and future non-HTTP contexts by assembling the final text here.
  const stream = await streamSummaryText(input);

  let summary = '';
  for await (const chunk of stream) {
    summary += chunk;
  }

  const normalizedSummary = summary.trim();

  if (normalizedSummary.length === 0) {
    throw new AppError('SummaryChain returned an empty summary.', 500);
  }

  return { summary: normalizedSummary };
}
