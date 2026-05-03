import { LOOP_WORKSPACES_STORAGE_KEY } from '@/lib/constants';
import type { LoopWorkspaceState, SessionState } from '@/types/session';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSessionState(value: unknown): value is SessionState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.sessionId === 'string' &&
    typeof value.subject === 'string' &&
    typeof value.subtopic === 'string' &&
    typeof value.persona === 'string' &&
    (value.confidence === 'low' || value.confidence === 'medium' || value.confidence === 'high') &&
    typeof value.classifierRanOnce === 'boolean' &&
    typeof value.material === 'string' &&
    (value.summary === null || typeof value.summary === 'string') &&
    Array.isArray(value.memorables) &&
    Array.isArray(value.flashcards) &&
    Array.isArray(value.serializedVectors) &&
    Array.isArray(value.recentMessages) &&
    typeof value.rollingSum === 'string' &&
    typeof value.tokenCount === 'number' &&
    (value.handoffSummary === null || typeof value.handoffSummary === 'string') &&
    (value.previousSessionSummary === null || typeof value.previousSessionSummary === 'string')
  );
}

function isLoopWorkspaceState(value: unknown): value is LoopWorkspaceState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.loopId === 'string' &&
    typeof value.materialDraft === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.sessionState === null || isSessionState(value.sessionState))
  );
}

function normalizeWorkspace(raw: LoopWorkspaceState): LoopWorkspaceState {
  const sessionMaterial = raw.sessionState?.material?.trim() ?? '';
  const materialDraft = raw.materialDraft.trim().length > 0 ? raw.materialDraft : sessionMaterial;

  return {
    ...raw,
    materialDraft,
  };
}

function readWorkspaceMap() {
  if (!canUseStorage()) {
    return {} as Record<string, LoopWorkspaceState>;
  }

  try {
    const raw = window.localStorage.getItem(LOOP_WORKSPACES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([loopId, value]) =>
        isLoopWorkspaceState(value) ? [[loopId, normalizeWorkspace(value)]] : [],
      ),
    );
  } catch {
    return {};
  }
}

function writeWorkspaceMap(workspaces: Record<string, LoopWorkspaceState>) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(LOOP_WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
}

export function createEmptyLoopWorkspace(loopId: string): LoopWorkspaceState {
  const now = Date.now();

  return {
    loopId,
    materialDraft: '',
    sessionState: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function readLoopWorkspace(loopId: string) {
  return readWorkspaceMap()[loopId] ?? null;
}

export function writeLoopWorkspace(workspace: LoopWorkspaceState) {
  const workspaces = readWorkspaceMap();
  const normalizedWorkspace = {
    ...normalizeWorkspace(workspace),
    updatedAt: Date.now(),
  };

  workspaces[normalizedWorkspace.loopId] = normalizedWorkspace;
  writeWorkspaceMap(workspaces);

  return normalizedWorkspace;
}

export function ensureLoopWorkspace(loopId: string) {
  const existing = readLoopWorkspace(loopId);

  if (existing) {
    return existing;
  }

  return writeLoopWorkspace(createEmptyLoopWorkspace(loopId));
}

export function updateLoopWorkspaceMaterial(loopId: string, materialDraft: string) {
  const existing = ensureLoopWorkspace(loopId);

  return writeLoopWorkspace({
    ...existing,
    materialDraft,
  });
}
