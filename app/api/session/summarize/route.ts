import { SUMMARY_STREAM_CHUNK_SIZE } from '@/lib/constants';
import { streamSummaryText } from '@/lib/langchain/chains/summaryChain';
import { AppError, toSafeError } from '@/lib/utils/errorHandler';

interface SummarizeRequestBody {
  material?: unknown;
  persona?: unknown;
}

const encoder = new TextEncoder();

function sseEvent(event: string, data: string): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function shouldFlushSummaryBuffer(buffer: string): boolean {
  return buffer.length >= SUMMARY_STREAM_CHUNK_SIZE || buffer.includes('\n');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SummarizeRequestBody;
    const material = typeof body.material === 'string' ? body.material.trim() : '';
    const persona = typeof body.persona === 'string' ? body.persona.trim() : '';

    if (material.length === 0) {
      throw new AppError('Material is required.', 400);
    }

    if (persona.length === 0) {
      throw new AppError('Persona is required.', 400);
    }

    const summaryStream = await streamSummaryText({ material, persona });

    let fullSummary = '';
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let pendingChunk = '';

          for await (const chunk of summaryStream) {
            fullSummary += chunk;
            pendingChunk += chunk;

            // Emit larger, more stable SSE chunks instead of mirroring every model token fragment.
            if (shouldFlushSummaryBuffer(pendingChunk)) {
              controller.enqueue(sseEvent('chunk', pendingChunk));
              pendingChunk = '';
            }
          }

          if (pendingChunk.length > 0) {
            controller.enqueue(sseEvent('chunk', pendingChunk));
          }

          controller.enqueue(sseEvent('complete', fullSummary.trim()));
          controller.close();
        } catch (error) {
          const safeError = toSafeError(error);
          controller.enqueue(sseEvent('error', safeError.message));
          controller.close();
        }
      },
    });

    return new Response(stream, {
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
