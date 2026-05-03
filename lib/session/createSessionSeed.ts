import { randomUUID } from 'crypto';

import { estimateTokens } from '@/lib/session/tokenCounter';
import type { ClassifierResult, SerializedVector, SessionState } from '@/types/session';

interface CreateSessionSeedInput {
  material: string;
  classifier: ClassifierResult;
  persona: string;
  serializedVectors: SerializedVector[];
  previousSessionSummary?: string | null;
}

export function createSessionSeed({
  material,
  classifier,
  persona,
  serializedVectors,
  previousSessionSummary = null,
}: CreateSessionSeedInput): SessionState {
  const normalizedMaterial = material.trim();

  return {
    // Session IDs let the client detect resumable or orphaned sessions in localStorage.
    sessionId: randomUUID(),
    subject: classifier.subject,
    subtopic: classifier.subtopic,
    persona,
    confidence: classifier.confidence,
    classifierRanOnce: true,
    material: normalizedMaterial,
    summary: null,
    memorables: [],
    flashcards: [],
    serializedVectors,
    recentMessages: [],
    rollingSum: '',
    // Start with a rough material-only token estimate; later phases will grow this with conversation state.
    tokenCount: estimateTokens(normalizedMaterial),
    handoffSummary: null,
    previousSessionSummary,
  };
}
