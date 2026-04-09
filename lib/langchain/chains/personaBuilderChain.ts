/**
 * PersonaBuilderChain
 * Purpose: Generate a 2-sentence expert system prompt for the detected subject/subtopic.
 * Input: { subject: string; subtopic: string }
 * Output: { persona: string }
 * LangChain concepts: LLMChain, ChatPromptTemplate
 * Note: Output is stored in localStorage and injected as system prompt into all downstream chains.
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent } from '@/lib/utils/responseParser';

export async function runPersonaBuilderChain(input: {
  subject: string;
  subtopic: string;
}): Promise<{ persona: string }> {
  const subject = input.subject.trim();
  const subtopic = input.subtopic.trim();

  if (subject.length === 0 || subtopic.length === 0) {
    throw new AppError('Subject and subtopic are required to build a persona.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `Write a concise expert study persona for an AI tutor.

Requirements:
- Exactly 2 sentences.
- Sound like a world-class specialist in the given subject and subtopic.
- Optimize for teaching clarity, conceptual accuracy, and exam-focused explanations.
- Return only the persona text with no label, bullets, or quotation marks.`,
    ],
    [
      'human',
      'Subject: {subject}\nSubtopic: {subtopic}',
    ],
  ]);

  // Collapse any segmented/model-formatted content into a single system-prompt string for reuse.
  const response = await prompt.pipe(llm).invoke({ subject, subtopic });
  const persona = getTextContent(response.content).replace(/\s+/g, ' ').trim();

  if (persona.length === 0) {
    throw new AppError('PersonaBuilderChain returned an empty persona.', 500);
  }

  return { persona };
}
