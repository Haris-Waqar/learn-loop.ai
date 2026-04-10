import { MAX_RECENT_MESSAGES, QA_STREAM_CHUNK_SIZE } from '@/lib/constants';
import { streamQAAnswerText } from '@/lib/langchain/chains/qaChain';
import { estimateMessagesTokens, estimateTokens } from '@/lib/session/tokenCounter';
import { AppError, toSafeError } from '@/lib/utils/errorHandler';
import type { Message, SerializedVector } from '@/types/session';

interface AskRequestBody {
  question?: unknown;
  persona?: unknown;
  recentMessages?: unknown;
  rollingSum?: unknown;
  serializedVectors?: unknown;
}

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function shouldFlushAnswerBuffer(buffer: string): boolean {
  return buffer.length >= QA_STREAM_CHUNK_SIZE || buffer.includes('\n');
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskRequestBody;
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const persona = typeof body.persona === 'string' ? body.persona.trim() : '';
    const rollingSum = typeof body.rollingSum === 'string' ? body.rollingSum : '';
    const recentMessages = Array.isArray(body.recentMessages) ? body.recentMessages : [];
    const serializedVectors = Array.isArray(body.serializedVectors) ? body.serializedVectors : [];

    if (question.length === 0) {
      throw new AppError('Question is required.', 400);
    }

    if (persona.length === 0) {
      throw new AppError('Persona is required.', 400);
    }

    if (!recentMessages.every(isValidMessage)) {
      throw new AppError('recentMessages is malformed.', 400);
    }

    if (!serializedVectors.every(isValidSerializedVector) || serializedVectors.length === 0) {
      throw new AppError('serializedVectors is malformed.', 400);
    }

    const { stream, retrievedChunks } = await streamQAAnswerText({
      question,
      persona,
      recentMessages,
      rollingSum,
      serializedVectors,
    });

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let pendingChunk = '';
          let answer = '';

          for await (const chunk of stream) {
            answer += chunk;
            pendingChunk += chunk;

            if (shouldFlushAnswerBuffer(pendingChunk)) {
              controller.enqueue(sseEvent('chunk', pendingChunk));
              pendingChunk = '';
            }
          }

          if (pendingChunk.length > 0) {
            controller.enqueue(sseEvent('chunk', pendingChunk));
          }

          const normalizedAnswer = answer.trim();
          if (normalizedAnswer.length === 0) {
            throw new AppError('QAChain returned an empty answer.', 500);
          }

          const now = Date.now();
          const updatedMessages: Message[] = [
            ...recentMessages,
            { role: 'user' as const, content: question, timestamp: now },
            { role: 'assistant' as const, content: normalizedAnswer, type: 'answer' as const, timestamp: now + 1 },
          ].slice(-MAX_RECENT_MESSAGES);

          const tokenCount = estimateTokens(rollingSum) + estimateMessagesTokens(updatedMessages);

          controller.enqueue(
            sseEvent('complete', {
              answer: normalizedAnswer,
              updatedMessages,
              tokenCount,
              retrievedChunks,
            }),
          );
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
