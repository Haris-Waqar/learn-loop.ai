'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Infinity,
  Layers3,
  LoaderCircle,
} from 'lucide-react';
import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { Button } from '@/components/ui/button';
import { LoopChatPanel } from '@/components/loop-chat-panel';
import { LoopToolsPanel } from '@/components/loop-tools-panel';
import { buildRecentLoopFromSession, upsertRecentLoop } from '@/lib/session/recentLoops';
import {
  createEmptyLoopWorkspace,
  ensureLoopWorkspace,
  updateLoopWorkspaceMaterial,
  writeLoopWorkspace,
} from '@/lib/session/workspacePersistence';
import { startLoopSession } from '@/lib/session/workspaceClient';
import type { LoopWorkspaceState, SessionState } from '@/types/session';

interface LoopWorkspaceShellProps {
  loopId: string;
}

export function LoopWorkspaceShell({ loopId }: LoopWorkspaceShellProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<LoopWorkspaceState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isStartingLoop, setIsStartingLoop] = useState(false);
  const [isRoutingNewLoop, startRouteTransition] = useTransition();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (loopId === 'new') {
      const nextLoopId = window.crypto?.randomUUID?.() ?? `loop-${Date.now()}`;
      const nextWorkspace = writeLoopWorkspace(createEmptyLoopWorkspace(nextLoopId));

      setWorkspace(nextWorkspace);
      setIsHydrating(false);

      startRouteTransition(() => {
        router.replace(`/loops/${nextLoopId}`);
      });

      return;
    }

    setWorkspace(ensureLoopWorkspace(loopId));
    setIsHydrating(false);
  }, [loopId, router]);

  const hasStarted = workspace?.sessionState !== null;
  const activeSession = workspace?.sessionState ?? null;
  const materialDraft = workspace?.materialDraft ?? '';
  const classificationLabel =
    activeSession && activeSession.subtopic.trim().length > 0
      ? `${activeSession.subject} - ${activeSession.subtopic}`
      : activeSession?.subject ?? 'Unstarted loop';

  function updateWorkspace(nextWorkspace: LoopWorkspaceState) {
    const savedWorkspace = writeLoopWorkspace(nextWorkspace);
    setWorkspace(savedWorkspace);
  }

  function handleMaterialDraftChange(nextValue: string) {
    if (!workspace) {
      return;
    }

    setStartError(null);
    const savedWorkspace = updateLoopWorkspaceMaterial(workspace.loopId, nextValue);
    setWorkspace(savedWorkspace);
  }

  function handleSessionStateChange(nextSessionState: SessionState) {
    if (!workspace) {
      return;
    }

    updateWorkspace({
      ...workspace,
      materialDraft: nextSessionState.material,
      sessionState: nextSessionState,
    });

    upsertRecentLoop(buildRecentLoopFromSession(nextSessionState));
  }

  function handleStartLoop() {
    if (!workspace || materialDraft.trim().length === 0 || isStartingLoop) {
      return;
    }

    setStartError(null);

    setIsStartingLoop(true);

    void startLoopSession({
      loopId: workspace.loopId,
      material: materialDraft,
      previousSessionSummary: workspace.sessionState?.handoffSummary ?? null,
    })
      .then((sessionState) => {
        const nextSessionState: SessionState = {
          ...sessionState,
          sessionId: workspace.loopId,
        };

        const nextWorkspace = {
          ...workspace,
          materialDraft: nextSessionState.material,
          sessionState: nextSessionState,
        };

        updateWorkspace(nextWorkspace);
        upsertRecentLoop(buildRecentLoopFromSession(nextSessionState));
      })
      .catch((error: unknown) => {
        setStartError(error instanceof Error ? error.message : 'Failed to start the loop.');
      })
      .finally(() => {
        setIsStartingLoop(false);
      });
  }

  if (isHydrating || isRoutingNewLoop || !workspace) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6">
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm">
            <LoaderCircle className="size-4 animate-spin" />
            {loopId === 'new' ? 'Preparing your new loop' : 'Restoring your loop'}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,183,179,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,214,170,0.12),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(79,183,179,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(29,78,216,0.14),transparent_24%)]" />
        <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),transparent)] dark:bg-[linear-gradient(180deg,rgba(9,15,24,0.72),transparent)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/loops"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Back to recent loops"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <Link href="/loops" className="inline-flex items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#4FB7B3] text-white shadow-[0_12px_30px_rgba(79,183,179,0.35)]">
                <Infinity className="size-5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">{classificationLabel}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {hasStarted ? 'Loop workspace' : 'Set up your loop'}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <DarkModeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.82fr)]">
          <LoopChatPanel sessionState={activeSession} onSessionStateChange={handleSessionStateChange} />

          <div className="grid gap-6">
            <section className="rounded-[28px] border border-border/70 bg-card/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#ffd6aa]/30 text-[#b66a17] dark:bg-[#ffd6aa]/12 dark:text-[#f6b15b]">
                    <Layers3 className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Sources</h2>
                    <p className="text-sm text-muted-foreground">Material and source previews anchor the loop here.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5 sm:p-6">
                {!hasStarted ? (
                  <>
                    <div className="rounded-2xl border border-dashed border-border bg-background/75 px-4 py-5 text-sm leading-7 text-muted-foreground">
                      Paste the primary material for this loop. Starting the loop will classify the topic, build a persona, and prepare retrieval vectors for later chat.
                    </div>

                    <div className="rounded-2xl border border-border bg-background/90 p-4">
                      <label
                        htmlFor="loop-material"
                        className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
                      >
                        Primary material
                      </label>
                      <textarea
                        id="loop-material"
                        value={materialDraft}
                        onChange={(event) => handleMaterialDraftChange(event.target.value)}
                        placeholder="Paste lecture notes, a transcript, an article, or any study material here."
                        className="mt-3 min-h-56 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-[#4FB7B3] focus:ring-4 focus:ring-[#4FB7B3]/15"
                      />
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          {materialDraft.trim().length > 0
                            ? `${materialDraft.trim().length.toLocaleString()} characters ready to start`
                            : 'No material added yet'}
                        </p>
                        <Button
                          onClick={handleStartLoop}
                          disabled={materialDraft.trim().length === 0 || isStartingLoop}
                          className="h-10 rounded-full bg-[#4FB7B3] px-5 text-white hover:bg-[#399f9a]"
                        >
                          {isStartingLoop ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" />
                              Starting loop
                            </>
                          ) : (
                            'Start loop'
                          )}
                        </Button>
                      </div>
                      {startError ? (
                        <p className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                          {startError}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    {(() => {
                      const restoredSession = activeSession!;

                      return (
                        <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-4">
                        <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Subject</p>
                        <p className="mt-2 text-base font-semibold">{restoredSession.subject}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-4">
                        <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Subtopic</p>
                        <p className="mt-2 text-base font-semibold">{restoredSession.subtopic}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-4">
                        <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Confidence</p>
                        <p className="mt-2 text-base font-semibold capitalize">{restoredSession.confidence}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/80 px-4 py-4">
                        <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Vectors</p>
                        <p className="mt-2 text-base font-semibold">
                          {restoredSession.serializedVectors.length.toLocaleString()} chunks ready
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/90 px-4 py-4">
                      <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Persona</p>
                      <p className="mt-3 text-sm leading-7 text-foreground/90">{restoredSession.persona}</p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/90 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Active material</p>
                        <span className="text-xs text-muted-foreground">
                          {restoredSession.material.length.toLocaleString()} characters
                        </span>
                      </div>
                      <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-foreground/90">
                        {restoredSession.material}
                      </div>
                    </div>
                        </>
                      );
                    })()}
                  </>
                )}

                <div className="rounded-2xl border border-border bg-background/80 px-4 py-4">
                  <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">Workspace status</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {hasStarted
                      ? 'This loop now restores its material, classifier output, persona, vectors, messages, and later study artifacts from local storage.'
                      : 'This loop already has a stable local ID and will be restored here once session state is created.'}
                  </p>
                </div>
              </div>
            </section>

            <LoopToolsPanel sessionState={activeSession} onSessionStateChange={handleSessionStateChange} />
          </div>
        </div>
      </div>
    </main>
  );
}
