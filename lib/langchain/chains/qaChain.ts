/**
 * QAChain
 * Purpose: Answer a user question using RAG (top 3 retrieved chunks) + conversation history.
 * Input: { question, persona, recentMessages, rollingSum, serializedVectors }
 * Output: { answer: string; updatedMessages: Message[] }
 * LangChain concepts: LLMChain, ChatPromptTemplate, MemoryVectorStore, similarity search
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { MAX_RECENT_MESSAGES, TOP_K_RETRIEVAL } from '@/lib/constants';
import { llmStream } from '@/lib/langchain/llmClient';
import { reconstructVectorStore } from '@/lib/langchain/vectorStore';
import { AppError } from '@/lib/utils/errorHandler';
import type { Message, SerializedVector } from '@/types/session';

interface RetrievedChunk {
  pageContent: string;
  metadata: Record<string, unknown>;
}

interface QAChainInput {
  question: string;
  persona: string;
  recentMessages: Message[];
  rollingSum: string;
  serializedVectors: SerializedVector[];
}

function formatRecentMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return 'No recent conversation yet.';
  }

  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n');
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

function buildUpdatedMessages(question: string, recentMessages: Message[], answer: string): Message[] {
  const now = Date.now();
  const nextMessages: Message[] = [
    ...recentMessages,
    { role: 'user', content: question, timestamp: now },
    { role: 'assistant', content: answer, type: 'answer', timestamp: now + 1 },
  ];

  return nextMessages.slice(-MAX_RECENT_MESSAGES);
}

function createQAPrompt() {
  return ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are answering a student's study question using retrieved source material.

Active persona:
{persona}

Rules:
- Use the retrieved material as the primary evidence for your answer.
- Use rolling context and recent conversation only as supporting context.
- If the source material is insufficient, say so briefly instead of inventing facts.
- Keep the answer clear, direct, and useful for studying.`,
    ],
    [
      'human',
      `Retrieved material:
{retrievedContext}

Earlier compressed context:
{rollingSum}

Recent conversation:
{recentConversation}

Current question:
{question}`,
    ],
  ]);
}

export async function streamQAAnswerText(input: QAChainInput): Promise<{
  stream: AsyncIterable<string>;
  retrievedChunks: RetrievedChunk[];
}> {
  const question = input.question.trim();
  const persona = input.persona.trim();

  if (question.length === 0) {
    throw new AppError('Question is required to generate an answer.', 400);
  }

  if (persona.length === 0) {
    throw new AppError('Persona is required to generate an answer.', 400);
  }

  const vectorStore = await reconstructVectorStore(input.serializedVectors);
  const documents = await vectorStore.similaritySearch(question, TOP_K_RETRIEVAL);

  if (documents.length === 0) {
    throw new AppError('No relevant study material was available for retrieval.', 500);
  }

  const retrievedChunks = documents.map((document) => ({
    pageContent: document.pageContent,
    metadata: document.metadata as Record<string, unknown>,
  }));

  const stream = await createQAPrompt().pipe(llmStream).stream({
    persona,
    retrievedContext: retrievedChunks.map((chunk, index) => `Chunk ${index + 1}: ${chunk.pageContent}`).join('\n\n'),
    rollingSum: input.rollingSum.trim() || 'No prior compressed context yet.',
    recentConversation: formatRecentMessages(input.recentMessages),
    question,
  });

  async function* textStream() {
    for await (const chunk of stream) {
      const text = extractChunkText(chunk.content);
      if (text.length > 0) {
        yield text;
      }
    }
  }

  return { stream: textStream(), retrievedChunks };
}

export async function runQAChain(input: {
  question: string;
  persona: string;
  recentMessages: Message[];
  rollingSum: string;
  serializedVectors: SerializedVector[];
}): Promise<{ answer: string; updatedMessages: Message[]; retrievedChunks: RetrievedChunk[] }> {
  // Keep the chain reusable in tests and future non-HTTP contexts by assembling the final answer here.
  const { stream, retrievedChunks } = await streamQAAnswerText(input);

  let answer = '';
  for await (const chunk of stream) {
    answer += chunk;
  }

  const normalizedAnswer = answer.trim();
  if (normalizedAnswer.length === 0) {
    throw new AppError('QAChain returned an empty answer.', 500);
  }

  return {
    answer: normalizedAnswer,
    updatedMessages: buildUpdatedMessages(input.question.trim(), input.recentMessages, normalizedAnswer),
    retrievedChunks,
  };
}
