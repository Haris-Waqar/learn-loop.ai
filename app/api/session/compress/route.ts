import { runCompressorChain } from '@/lib/langchain/chains/compressorChain';
import { AppError, toSafeError } from '@/lib/utils/errorHandler';
import type { ApiResponse, Message } from '@/types/session';

interface CompressRequestBody {
  messages?: unknown;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompressRequestBody;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.every(isValidMessage) || messages.length === 0) {
      throw new AppError('messages is malformed.', 400);
    }

    const data = await runCompressorChain({ messages });
    const response: ApiResponse<typeof data> = { success: true, data };

    return Response.json(response);
  } catch (error) {
    const safeError = toSafeError(error);
    const response: ApiResponse<{ summaryChunk: string }> = {
      success: false,
      error: safeError.message,
    };

    return Response.json(response, { status: safeError.statusCode });
  }
}
