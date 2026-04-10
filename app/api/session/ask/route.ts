import { MAX_RECENT_MESSAGES, QA_STREAM_CHUNK_SIZE, SUMMARY_STREAM_CHUNK_SIZE } from '@/lib/constants';
import { runCompressorChain } from '@/lib/langchain/chains/compressorChain';
import { runFlashcardChain } from '@/lib/langchain/chains/flashcardChain';
import { runIntentClassifierChain } from '@/lib/langchain/chains/intentClassifierChain';
import { runMemorableChain } from '@/lib/langchain/chains/memorableChain';
import { streamQAAnswerText } from '@/lib/langchain/chains/qaChain';
import { streamSummaryText } from '@/lib/langchain/chains/summaryChain';
import { runTopicShiftChain } from '@/lib/langchain/chains/topicShiftChain';
import { estimateMessagesTokens, estimateTokens, shouldCompress, shouldWarn } from '@/lib/session/tokenCounter';
import { AppError, toSafeError } from '@/lib/utils/errorHandler';
import type {
  Flashcard,
  IntentClassificationResult,
  Message,
  SerializedVector,
  StudyIntent,
  TopicShiftResult,
} from '@/types/session';

interface AskRequestBody {
  question?: unknown;
  material?: unknown;
  summary?: unknown;
  memorables?: unknown;
  persona?: unknown;
  currentSubject?: unknown;
  currentSubtopic?: unknown;
  recentMessages?: unknown;
  rollingSum?: unknown;
  serializedVectors?: unknown;
}

interface RetrievedChunk {
  pageContent: string;
  metadata: Record<string, unknown>;
}

interface BaseCompleteEvent {
  intent: StudyIntent;
  intentConfidence: IntentClassificationResult['confidence'];
  updatedMessages: Message[];
  rollingSum: string;
  tokenCount: number;
  compressionApplied: boolean;
  shouldWarn: boolean;
}

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function shouldFlushBuffer(buffer: string, chunkSize: number): boolean {
  return buffer.length >= chunkSize || buffer.includes('\n');
}

function isValidMessage(value: unknown): value is Message {
  return (
    !!value &&
    typeof value === 'object' &&
    'role' in value &&
    'content' in value &&
    'timestamp' in value &&
    ((value as { role?: unknown }).role === 'user' || (value as { role?: unknown }).role === 'assistant') &&
    typeof (value as { content?: unknown }).content === 'string' &&
    typeof (value as { timestamp?: unknown }).timestamp === 'number'
  );
}

function isValidSerializedVector(value: unknown): value is SerializedVector {
  return (
    !!value &&
    typeof value === 'object' &&
    'pageContent' in value &&
    'metadata' in value &&
    'embedding' in value &&
    typeof (value as { pageContent?: unknown }).pageContent === 'string' &&
    typeof (value as { metadata?: unknown }).metadata === 'object' &&
    (value as { metadata?: unknown }).metadata !== null &&
    Array.isArray((value as { embedding?: unknown }).embedding)
  );
}

function buildUpdatedMessages(
  recentMessages: Message[],
  question: string,
  assistantContent: string,
  assistantType: Message['type'],
): Message[] {
  const now = Date.now();

  return [
    ...recentMessages,
    { role: 'user' as const, content: question, timestamp: now },
    {
      role: 'assistant' as const,
      content: assistantContent,
      type: assistantType,
      timestamp: now + 1,
    },
  ].slice(-MAX_RECENT_MESSAGES);
}

async function applyCompressionToMessages(
  rollingSum: string,
  updatedMessages: Message[],
): Promise<{
  rollingSum: string;
  updatedMessages: Message[];
  tokenCount: number;
  compressionApplied: boolean;
}> {
  let nextRollingSum = rollingSum.trim();
  let nextUpdatedMessages = updatedMessages;
  let tokenCount = estimateTokens(nextRollingSum) + estimateMessagesTokens(nextUpdatedMessages);
  let compressionApplied = false;

  if (shouldCompress(tokenCount) && nextUpdatedMessages.length >= 4) {
    const messagesToCompress = nextUpdatedMessages.slice(0, 4);
    const remainingMessages = nextUpdatedMessages.slice(4);
    const { summaryChunk } = await runCompressorChain({ messages: messagesToCompress });

    nextRollingSum = nextRollingSum.length > 0 ? `${nextRollingSum} ${summaryChunk}` : summaryChunk;
    nextUpdatedMessages = remainingMessages;
    tokenCount = estimateTokens(nextRollingSum) + estimateMessagesTokens(nextUpdatedMessages);
    compressionApplied = true;
  }

  return {
    rollingSum: nextRollingSum,
    updatedMessages: nextUpdatedMessages,
    tokenCount,
    compressionApplied,
  };
}

async function streamTextIntoSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  stream: AsyncIterable<string>,
  chunkSize: number,
): Promise<string> {
  let fullText = '';
  let pendingChunk = '';

  for await (const chunk of stream) {
    fullText += chunk;
    pendingChunk += chunk;

    if (shouldFlushBuffer(pendingChunk, chunkSize)) {
      controller.enqueue(sseEvent('chunk', pendingChunk));
      pendingChunk = '';
    }
  }

  if (pendingChunk.length > 0) {
    controller.enqueue(sseEvent('chunk', pendingChunk));
  }

  return fullText.trim();
}

function createStatusMessage(intent: Exclude<StudyIntent, 'qa'>, count?: number): string {
  if (intent === 'summarize') {
    return 'Generated a summary of the current session.';
  }

  if (intent === 'memorables') {
    return `Generated ${count ?? 0} memorable points from the current session.`;
  }

  return `Generated ${count ?? 0} flashcards from the current session.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskRequestBody;
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const material = typeof body.material === 'string' ? body.material.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary : null;
    const persona = typeof body.persona === 'string' ? body.persona.trim() : '';
    const currentSubject = typeof body.currentSubject === 'string' ? body.currentSubject.trim() : '';
    const currentSubtopic = typeof body.currentSubtopic === 'string' ? body.currentSubtopic.trim() : '';
    const rollingSum = typeof body.rollingSum === 'string' ? body.rollingSum : '';
    const recentMessages = Array.isArray(body.recentMessages) ? body.recentMessages : [];
    const memorables = Array.isArray(body.memorables)
      ? body.memorables.filter((value): value is string => typeof value === 'string')
      : [];
    const serializedVectors = Array.isArray(body.serializedVectors) ? body.serializedVectors : [];

    if (question.length === 0) {
      throw new AppError('Question is required.', 400);
    }

    if (material.length === 0) {
      throw new AppError('Material is required.', 400);
    }

    if (persona.length === 0) {
      throw new AppError('Persona is required.', 400);
    }

    if (currentSubject.length === 0 || currentSubtopic.length === 0) {
      throw new AppError('currentSubject and currentSubtopic are required.', 400);
    }

    if (!recentMessages.every(isValidMessage)) {
      throw new AppError('recentMessages is malformed.', 400);
    }

    if (!serializedVectors.every(isValidSerializedVector) || serializedVectors.length === 0) {
      throw new AppError('serializedVectors is malformed.', 400);
    }

    const intentResult = await runIntentClassifierChain({
      userMessage: question,
      currentSubject,
      currentSubtopic,
      recentMessages,
    });

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (intentResult.intent === 'qa') {
            const { stream, retrievedChunks } = await streamQAAnswerText({
              question,
              persona,
              recentMessages,
              rollingSum,
              serializedVectors,
            });
            const topicShiftPromise = runTopicShiftChain({
              currentSubject,
              currentSubtopic,
              userMessage: question,
            });
            const answer = await streamTextIntoSse(controller, stream, QA_STREAM_CHUNK_SIZE);

            if (answer.length === 0) {
              throw new AppError('QAChain returned an empty answer.', 500);
            }

            const nextMessages = buildUpdatedMessages(recentMessages, question, answer, 'answer');
            const compressed = await applyCompressionToMessages(rollingSum, nextMessages);
            const topicShift = await topicShiftPromise;

            const completeEvent: BaseCompleteEvent & {
              answer: string;
              retrievedChunks: RetrievedChunk[];
              topicShift: TopicShiftResult;
            } = {
              intent: 'qa',
              intentConfidence: intentResult.confidence,
              answer,
              retrievedChunks,
              topicShift,
              updatedMessages: compressed.updatedMessages,
              rollingSum: compressed.rollingSum,
              tokenCount: compressed.tokenCount,
              compressionApplied: compressed.compressionApplied,
              shouldWarn: shouldWarn(compressed.tokenCount),
            };

            controller.enqueue(sseEvent('complete', completeEvent));
            controller.close();
            return;
          }

          if (intentResult.intent === 'summarize') {
            const summaryStream = await streamSummaryText({ material, persona });
            const summaryText = await streamTextIntoSse(controller, summaryStream, SUMMARY_STREAM_CHUNK_SIZE);

            if (summaryText.length === 0) {
              throw new AppError('SummaryChain returned an empty summary.', 500);
            }

            const nextMessages = buildUpdatedMessages(
              recentMessages,
              question,
              createStatusMessage('summarize'),
              'summary',
            );
            const compressed = await applyCompressionToMessages(rollingSum, nextMessages);

            const completeEvent: BaseCompleteEvent & { summary: string } = {
              intent: 'summarize',
              intentConfidence: intentResult.confidence,
              summary: summaryText,
              updatedMessages: compressed.updatedMessages,
              rollingSum: compressed.rollingSum,
              tokenCount: compressed.tokenCount,
              compressionApplied: compressed.compressionApplied,
              shouldWarn: shouldWarn(compressed.tokenCount),
            };

            controller.enqueue(sseEvent('complete', completeEvent));
            controller.close();
            return;
          }

          if (intentResult.intent === 'memorables') {
            const { memorables: generatedMemorables } = await runMemorableChain({
              material,
              summary,
              recentMessages,
              rollingSum,
              persona,
            });
            const nextMessages = buildUpdatedMessages(
              recentMessages,
              question,
              createStatusMessage('memorables', generatedMemorables.length),
              'memorable',
            );
            const compressed = await applyCompressionToMessages(rollingSum, nextMessages);

            const completeEvent: BaseCompleteEvent & { memorables: string[] } = {
              intent: 'memorables',
              intentConfidence: intentResult.confidence,
              memorables: generatedMemorables,
              updatedMessages: compressed.updatedMessages,
              rollingSum: compressed.rollingSum,
              tokenCount: compressed.tokenCount,
              compressionApplied: compressed.compressionApplied,
              shouldWarn: shouldWarn(compressed.tokenCount),
            };

            controller.enqueue(sseEvent('complete', completeEvent));
            controller.close();
            return;
          }

          const { flashcards } = await runFlashcardChain({
            material,
            summary,
            memorables,
            recentMessages,
            rollingSum,
            persona,
          });
          const nextMessages = buildUpdatedMessages(
            recentMessages,
            question,
            createStatusMessage('flashcards', flashcards.length),
            'flashcard',
          );
          const compressed = await applyCompressionToMessages(rollingSum, nextMessages);

          const completeEvent: BaseCompleteEvent & { flashcards: Flashcard[] } = {
            intent: 'flashcards',
            intentConfidence: intentResult.confidence,
            flashcards,
            updatedMessages: compressed.updatedMessages,
            rollingSum: compressed.rollingSum,
            tokenCount: compressed.tokenCount,
            compressionApplied: compressed.compressionApplied,
            shouldWarn: shouldWarn(compressed.tokenCount),
          };

          controller.enqueue(sseEvent('complete', completeEvent));
          controller.close();
        } catch (error) {
          const safeError = toSafeError(error);
          controller.enqueue(sseEvent('error', safeError.message));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const safeError = toSafeError(error);
    return Response.json(
      {
        success: false,
        error: safeError.message,
      },
      { status: safeError.statusCode },
    );
  }
}
