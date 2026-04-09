import { createSessionSeed } from '@/lib/session/createSessionSeed';
import { runClassifierChain } from '@/lib/langchain/chains/classifierChain';
import { runPersonaBuilderChain } from '@/lib/langchain/chains/personaBuilderChain';
import { embedAndSerialize } from '@/lib/langchain/vectorStore';
import { AppError, toSafeError } from '@/lib/utils/errorHandler';
import type { ApiResponse, SessionState } from '@/types/session';

interface StartSessionRequestBody {
  material?: unknown;
  previousSessionSummary?: unknown;
}

function normalizePreviousSessionSummary(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('previousSessionSummary must be a string when provided.', 400);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartSessionRequestBody;
    const material = typeof body.material === 'string' ? body.material.trim() : '';

    if (material.length === 0) {
      throw new AppError('Material is required.', 400);
    }

    const previousSessionSummary = normalizePreviousSessionSummary(body.previousSessionSummary);

    // We prepare retrieval state at session start so later Q&A does not depend on the
    // user running SummaryChain first. The summary is a study artifact; vectors are the searchable source memory.
    // Classification and embedding are independent, so do the expensive work in parallel.
    const [classifier, serializedVectors] = await Promise.all([
      runClassifierChain({ material }),
      embedAndSerialize(material),
    ]);

    // Persona depends on classification because it is specialized to the detected subject/subtopic.
    const { persona } = await runPersonaBuilderChain({
      subject: classifier.subject,
      subtopic: classifier.subtopic,
    });

    // The route returns the full client-persisted session shape, not just raw chain outputs.
    const sessionState = createSessionSeed({
      material,
      classifier,
      persona,
      serializedVectors,
      previousSessionSummary,
    });

    const response: ApiResponse<SessionState> = {
      success: true,
      data: sessionState,
    };

    return Response.json(response);
  } catch (error) {
    // Surface safe client-facing errors while keeping raw error details on the server.
    const safeError = toSafeError(error);
    const response: ApiResponse<SessionState> = {
      success: false,
      error: safeError.message,
    };

    return Response.json(response, { status: safeError.statusCode });
  }
}
