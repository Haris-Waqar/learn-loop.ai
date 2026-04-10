import { runHandoffChain } from '@/lib/langchain/chains/handoffChain';
import { AppError, toSafeError } from '@/lib/utils/errorHandler';
import type { ApiResponse, Message } from '@/types/session';

interface HandoffRequestBody {
  material?: unknown;
  summary?: unknown;
  recentMessages?: unknown;
  rollingSum?: unknown;
  persona?: unknown;
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
    const body = (await request.json()) as HandoffRequestBody;
    const material = typeof body.material === 'string' ? body.material : '';
    const summary = typeof body.summary === 'string' ? body.summary : null;
    const rollingSum = typeof body.rollingSum === 'string' ? body.rollingSum : '';
    const persona = typeof body.persona === 'string' ? body.persona : '';
    const recentMessages = Array.isArray(body.recentMessages) ? body.recentMessages : [];

    if (material.trim().length === 0) {
      throw new AppError('Material is required.', 400);
    }

    if (persona.trim().length === 0) {
      throw new AppError('Persona is required.', 400);
    }

    if (!recentMessages.every(isValidMessage)) {
      throw new AppError('recentMessages is malformed.', 400);
    }

    const data = await runHandoffChain({
      material,
      summary,
      recentMessages,
      rollingSum,
      persona,
    });
    const response: ApiResponse<typeof data> = { success: true, data };

    return Response.json(response);
  } catch (error) {
    const safeError = toSafeError(error);
    const response: ApiResponse<{ handoffSummary: string }> = {
      success: false,
      error: safeError.message,
    };

    return Response.json(response, { status: safeError.statusCode });
  }
}
