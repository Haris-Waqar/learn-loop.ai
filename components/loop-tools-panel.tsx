'use client';

import { useState } from 'react';
import {
  BookOpenText,
  BrainCircuit,
  Layers3,
  LoaderCircle,
  Sparkles,
  SwatchBook,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { streamSummaryTool, runFlashcardsTool, runHandoffTool, runMemorablesTool } from '@/lib/session/toolClients';
import { cn } from '@/lib/utils';
import type { Flashcard, SessionState } from '@/types/session';

interface LoopToolsPanelProps {
  sessionState: SessionState | null;
  onSessionStateChange: (nextSessionState: SessionState) => void;
}

type ToolKey = 'summary' | 'memorables' | 'flashcards' | 'handoff';

interface ToolCardConfig {
  key: ToolKey;
  label: string;
  description: string;
  icon: typeof SwatchBook;
}

const TOOL_CARDS: ToolCardConfig[] = [
  {
    key: 'summary',
    label: 'Summary',
    description: 'Generate a compact summary of your current material and discussion.',
    icon: SwatchBook,
  },
  {
    key: 'memorables',
    label: 'Memorables',
    description: 'Pull out the standout ideas worth retaining after this loop.',
    icon: Sparkles,
  },
  {
    key: 'flashcards',
    label: 'Flashcards',
    description: 'Turn what you studied into quick front-and-back recall prompts.',
    icon: Layers3,
  },
  {
    key: 'handoff',
    label: 'Handoff',
    description: 'Capture the next-session handoff once this loop is ready to pause.',
    icon: Wand2,
  },
] as const;

function resultMetaLabel(toolKey: ToolKey, sessionState: SessionState | null) {
  if (!sessionState) {
    return 'Available after the loop starts';
  }

  if (toolKey === 'summary') {
    return sessionState.summary ? 'Stored and restorable' : 'No summary generated yet';
  }

  if (toolKey === 'memorables') {
    return sessionState.memorables.length > 0
      ? `${sessionState.memorables.length} items stored`
      : 'No memorables generated yet';
  }

  if (toolKey === 'flashcards') {
    return sessionState.flashcards.length > 0
      ? `${sessionState.flashcards.length} cards stored`
      : 'No flashcards generated yet';
  }

  return sessionState.handoffSummary ? 'Stored and restorable' : 'No handoff generated yet';
}

function applyToolResult(
  sessionState: SessionState,
  toolKey: ToolKey,
  payload: string | string[] | Flashcard[],
) {
  if (toolKey === 'summary') {
    return {
      ...sessionState,
      summary: payload as string,
    };
  }

  if (toolKey === 'memorables') {
    return {
      ...sessionState,
      memorables: payload as string[],
    };
  }

  if (toolKey === 'flashcards') {
    return {
      ...sessionState,
      flashcards: payload as Flashcard[],
    };
  }

  return {
    ...sessionState,
    handoffSummary: payload as string,
  };
}

export function LoopToolsPanel({ sessionState, onSessionStateChange }: LoopToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  const [summaryThinking, setSummaryThinking] = useState<string | null>(null);
  const [streamedSummary, setStreamedSummary] = useState('');

  const isDisabled = sessionState === null;

  async function handleToolAction(toolKey: ToolKey) {
    if (!sessionState || activeTool) {
      return;
    }

    setActiveTool(toolKey);
    setToolError(null);

    try {
      if (toolKey === 'summary') {
        setSummaryThinking('Preparing a summary');
        setStreamedSummary('');

        await streamSummaryTool(sessionState, {
          onThinking: (message) => {
            setSummaryThinking(message);
          },
          onChunk: (chunk) => {
            setStreamedSummary((current) => current + chunk);
          },
          onComplete: (summary) => {
            onSessionStateChange(applyToolResult(sessionState, 'summary', summary));
            setSummaryThinking(null);
            setStreamedSummary('');
            setActiveTool(null);
          },
          onError: (message) => {
            setToolError(message);
            setSummaryThinking(null);
            setStreamedSummary('');
            setActiveTool(null);
          },
        });

        return;
      }

      if (toolKey === 'memorables') {
        const { memorables } = await runMemorablesTool(sessionState);
        onSessionStateChange(applyToolResult(sessionState, 'memorables', memorables));
      } else if (toolKey === 'flashcards') {
        const { flashcards } = await runFlashcardsTool(sessionState);
        onSessionStateChange(applyToolResult(sessionState, 'flashcards', flashcards));
      } else {
        const { handoffSummary } = await runHandoffTool(sessionState);
        onSessionStateChange(applyToolResult(sessionState, 'handoff', handoffSummary));
      }

      setActiveTool(null);
    } catch (error) {
      setToolError(error instanceof Error ? error.message : 'Tool request failed.');
      setSummaryThinking(null);
      setStreamedSummary('');
      setActiveTool(null);
    }
  }

  return (
    <section className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(2,6,23,0.28)] lg:col-span-2 xl:col-span-1">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#4FB7B3]/12 text-[#2f9f9a] dark:bg-[#4FB7B3]/16 dark:text-[#79d8d4]">
            <Wand2 className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Artifacts</h2>
            <p className="text-sm text-muted-foreground">Generate study artifacts and keep the results organized outside the chat.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {TOOL_CARDS.map(({ key, label, description, icon: Icon }) => {
            const isRunning = activeTool === key;

            return (
              <div
                key={key}
                className={cn(
                  'rounded-3xl border border-border bg-background/80 p-4 transition-colors hover:bg-accent/40',
                  isDisabled && 'opacity-70',
                )}
              >
                <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-card text-card-foreground shadow-sm">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                <p className="mt-3 text-xs text-muted-foreground">{resultMetaLabel(key, sessionState)}</p>
                <Button
                  onClick={() => handleToolAction(key)}
                  disabled={isDisabled || !!activeTool}
                  variant="outline"
                  className="mt-4 h-9 rounded-full px-4"
                >
                  {isRunning ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Running
                    </>
                  ) : (
                    `Run ${label}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {toolError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {toolError}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-background/75 p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpenText className="size-4 text-[#4FB7B3]" />
              <h3 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">Summary</h3>
            </div>

            {summaryThinking ? (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" />
                {summaryThinking}
              </div>
            ) : null}

            {streamedSummary ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-foreground">
                {streamedSummary}
              </div>
            ) : sessionState?.summary ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-foreground">
                {sessionState.summary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary generated yet. Use the explicit Summary action or ask for one in chat.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-background/75 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-[#4FB7B3]" />
              <h3 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">Memorables</h3>
            </div>

            {sessionState?.memorables.length ? (
              <ul className="space-y-2 text-sm leading-7 text-foreground">
                {sessionState.memorables.map((item) => (
                  <li key={item} className="rounded-2xl border border-border bg-card px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No memorables generated yet.</p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-background/75 p-4">
            <div className="mb-3 flex items-center gap-2">
              <BrainCircuit className="size-4 text-[#4FB7B3]" />
              <h3 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">Flashcards</h3>
            </div>

            {sessionState?.flashcards.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {sessionState.flashcards.map((card, index) => (
                  <div key={`${card.front}-${index}`} className="rounded-2xl border border-border bg-card px-4 py-4">
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">Front</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{card.front}</p>
                    <p className="mt-4 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">Back</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{card.back}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No flashcards generated yet.</p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-background/75 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wand2 className="size-4 text-[#4FB7B3]" />
              <h3 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">Handoff</h3>
            </div>

            {sessionState?.handoffSummary ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-foreground">
                {sessionState.handoffSummary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No handoff generated yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
