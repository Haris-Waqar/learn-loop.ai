import type { ApiResponse, SessionState } from '@/types/session';

interface StartLoopInput {
  loopId: string;
  material: string;
  previousSessionSummary?: string | null;
}

export async function startLoopSession({
  loopId,
  material,
  previousSessionSummary = null,
}: StartLoopInput): Promise<SessionState> {
  const response = await fetch('/api/session/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      material,
      previousSessionSummary,
    }),
  });

  const payload = (await response.json()) as ApiResponse<SessionState>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? 'Failed to start the loop.');
  }

  return {
    ...payload.data,
    sessionId: loopId,
  };
}
