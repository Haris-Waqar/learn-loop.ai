import { RECENT_LOOPS_STORAGE_KEY } from '@/lib/constants';
import type { RecentLoop, SessionState } from '@/types/session';

function isRecentLoop(value: unknown): value is RecentLoop {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.loopId === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.subject === 'string' &&
    typeof candidate.subtopic === 'string' &&
    typeof candidate.updatedAt === 'number' &&
    typeof candidate.sourceCount === 'number'
  );
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeLabel(value: string) {
  return value.trim();
}

export function deriveRecentLoopTitle(subject: string, subtopic: string) {
  const normalizedSubject = normalizeLabel(subject);
  const normalizedSubtopic = normalizeLabel(subtopic);

  if (normalizedSubject && normalizedSubtopic) {
    return `${normalizedSubject} — ${normalizedSubtopic}`;
  }

  if (normalizedSubject) {
    return normalizedSubject;
  }

  return 'Untitled Loop';
}

export function sortRecentLoops(loops: RecentLoop[]) {
  return [...loops].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readRecentLoops() {
  if (!canUseStorage()) {
    return [] as RecentLoop[];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_LOOPS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortRecentLoops(parsed.filter(isRecentLoop));
  } catch {
    return [];
  }
}

export function writeRecentLoops(loops: RecentLoop[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(RECENT_LOOPS_STORAGE_KEY, JSON.stringify(sortRecentLoops(loops)));
}

export function buildRecentLoopFromSession(session: SessionState): RecentLoop {
  return {
    loopId: session.sessionId,
    title: deriveRecentLoopTitle(session.subject, session.subtopic),
    subject: normalizeLabel(session.subject),
    subtopic: normalizeLabel(session.subtopic),
    updatedAt: Date.now(),
    sourceCount: 1,
  };
}

export function upsertRecentLoop(loop: RecentLoop) {
  const nextLoops = readRecentLoops().filter((entry) => entry.loopId !== loop.loopId);
  nextLoops.push(loop);
  writeRecentLoops(nextLoops);
  return sortRecentLoops(nextLoops);
}

export function touchRecentLoop(loopId: string) {
  const loops = readRecentLoops();
  const match = loops.find((entry) => entry.loopId === loopId);

  if (!match) {
    return loops;
  }

  const nextLoop = {
    ...match,
    updatedAt: Date.now(),
  };

  return upsertRecentLoop(nextLoop);
}

export function getRecentLoop(loopId: string) {
  return readRecentLoops().find((loop) => loop.loopId === loopId) ?? null;
}
