/**
 * ClassifierChain
 * Purpose: Detect the academic subject and subtopic of the provided material.
 * Input: { material: string }
 * Output: ClassifierResult { subject, subtopic, confidence }
 * LangChain concepts: LLMChain, ChatPromptTemplate, StructuredOutputParser
 */
import type { ClassifierResult } from '@/types/session';
import { llm } from '@/lib/langchain/llmClient';
import { AppError } from '@/lib/utils/errorHandler';
import { getTextContent, parseJsonResponse } from '@/lib/utils/responseParser';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const VALID_CONFIDENCE = new Set<ClassifierResult['confidence']>(['low', 'medium', 'high']);

export async function runClassifierChain(input: {
  material: string;
}): Promise<ClassifierResult> {
  const material = input.material.trim();

  if (material.length === 0) {
    throw new AppError('Study material is required to classify a session.', 400);
  }

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You classify academic learning material.
Return JSON only with this exact shape:
{{
  "subject": string,
  "subtopic": string,
  "confidence": "low" | "medium" | "high"
}}

Rules:
- "subject" must be a concise academic or professional domain label.
- "subtopic" must be a more specific concept within that subject.
- "confidence" reflects how clearly the material signals the classification.
- Do not include markdown fences or any extra keys.`,
    ],
    [
      'human',
      'Classify the following study material:\n\n{material}',
    ],
  ]);

  // Run the prompt through the shared model, then normalize the chat response into JSON text.
  const response = await prompt.pipe(llm).invoke({ material });
  const parsed = parseJsonResponse<Partial<ClassifierResult>>(getTextContent(response.content));

  const subject = parsed.subject?.trim();
  const subtopic = parsed.subtopic?.trim();
  const confidence = parsed.confidence;

  // Fail fast if the model drifts from the contract; downstream session state depends on this shape.
  if (!subject || !subtopic || !confidence || !VALID_CONFIDENCE.has(confidence)) {
    throw new AppError('ClassifierChain returned invalid classification output.', 500, {
      parsed,
    });
  }

  return { subject, subtopic, confidence };
}
