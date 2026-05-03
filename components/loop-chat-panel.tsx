'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  SendHorizonal,
  Sparkles,
  SwatchBook,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { streamAskLoop } from '@/lib/session/askStream';
import { cn } from '@/lib/utils';
import type {
  AskCompleteEvent,
  Flashcard,
  Message,
  SessionState,
  StudyIntent,
  TopicShiftResult,
} from '@/types/session';

interface LoopChatPanelProps {
  sessionState: SessionState | null;
  onSessionStateChange: (nextSessionState: SessionState) => void;
}

interface LatestChatResult {
  intent: StudyIntent;
  summary?: string;
  memorables?: string[];
  flashcards?: Flashcard[];
  topicShift?: TopicShiftResult;
}

function messageTypeLabel(type: Message['type']) {
  if (type === 'summary') {
    return 'Summary';
  }

  if (type === 'memorable') {
    return 'Memorables';
  }

  if (type === 'flashcard') {
    return 'Flashcards';
  }

  if (type === 'answer') {
    return 'Answer';
  }

  return null;
}

function messageTypeIcon(type: Message['type']) {
  if (type === 'summary') {
    return <SwatchBook className="size-3.5" />;
  }

  if (type === 'memorable') {
    return <Sparkles className="size-3.5" />;
  }

  if (type === 'flashcard') {
    return <Layers3 className="size-3.5" />;
  }

  return <Bot className="size-3.5" />;
}

function intentLabel(intent: StudyIntent) {
  if (intent === 'qa') {
    return 'Question';
  }

  if (intent === 'summarize') {
    return 'Summary';
  }

  if (intent === 'memorables') {
    return 'Memorables';
  }

  return 'Flashcards';
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function buildNextSessionState(sessionState: SessionState, completeEvent: AskCompleteEvent): SessionState {
  const nextSessionState: SessionState = {
    ...sessionState,
    recentMessages: completeEvent.updatedMessages,
    rollingSum: completeEvent.rollingSum,
    tokenCount: completeEvent.tokenCount,
  };

  if (completeEvent.intent === 'summarize') {
    nextSessionState.summary = completeEvent.summary;
  } else if (completeEvent.intent === 'memorables') {
    nextSessionState.memorables = completeEvent.memorables;
  } else if (completeEvent.intent === 'flashcards') {
    nextSessionState.flashcards = completeEvent.flashcards;
  }

  return nextSessionState;
}

export function LoopChatPanel({ sessionState, onSessionStateChange }: LoopChatPanelProps) {
  const [question, setQuestion] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);
  const [streamedAssistantText, setStreamedAssistantText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestTopicShift, setLatestTopicShift] = useState<TopicShiftResult | null>(null);
  const [latestResult, setLatestResult] = useState<LatestChatResult | null>(null);
  const [latestStatusNote, setLatestStatusNote] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const transcriptMessages = useMemo(() => sessionState?.recentMessages ?? [], [sessionState?.recentMessages]);
  const tokenCount = sessionState?.tokenCount ?? 0;
  const tokenWarningLevel = sessionState ? (tokenCount >= 3200 ? 'warning' : tokenCount >= 2400 ? 'watch' : 'healthy') : 'healthy';

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcriptMessages, pendingQuestion, streamedAssistantText, thinkingMessage, latestResult]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionState || isSubmitting) {
      return;
    }

    const normalizedQuestion = question.trim();
    if (normalizedQuestion.length === 0) {
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setQuestion('');
    setChatError(null);
    setThinkingMessage('Classifying your request');
    setPendingQuestion(normalizedQuestion);
    setStreamedAssistantText('');
    setIsSubmitting(true);
    setLatestTopicShift(null);
    setLatestStatusNote(null);

    try {
      await streamAskLoop({
        question: normalizedQuestion,
        sessionState,
        signal: abortController.signal,
        onThinking: (message) => {
          setThinkingMessage(message);
        },
        onChunk: (chunk) => {
          setStreamedAssistantText((current) => current + chunk);
        },
        onComplete: (completeEvent) => {
          const nextSessionState = buildNextSessionState(sessionState, completeEvent);
          onSessionStateChange(nextSessionState);

          setLatestResult({
            intent: completeEvent.intent,
            summary: completeEvent.intent === 'summarize' ? completeEvent.summary : undefined,
            memorables: completeEvent.intent === 'memorables' ? completeEvent.memorables : undefined,
            flashcards: completeEvent.intent === 'flashcards' ? completeEvent.flashcards : undefined,
            topicShift: completeEvent.intent === 'qa' ? completeEvent.topicShift : undefined,
          });

          if (completeEvent.intent === 'qa') {
            setLatestTopicShift(completeEvent.topicShift);
          }

          if (completeEvent.shouldWarn) {
            setLatestStatusNote('This loop is nearing its token budget. A later step will add clearer token controls.');
          } else if (completeEvent.compressionApplied) {
            setLatestStatusNote('Older messages were compressed into the loop memory to make room for more conversation.');
          } else {
            setLatestStatusNote(null);
          }

          setThinkingMessage(null);
          setPendingQuestion(null);
          setStreamedAssistantText('');
          setIsSubmitting(false);
        },
        onError: (message) => {
          setChatError(message);
          setThinkingMessage(null);
          setPendingQuestion(null);
          setStreamedAssistantText('');
          setIsSubmitting(false);
        },
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      setChatError(error instanceof Error ? error.message : 'Failed to send your message.');
      setThinkingMessage(null);
      setPendingQuestion(null);
      setStreamedAssistantText('');
      setIsSubmitting(false);
    }
  }

  const isDisabled = sessionState === null;

  return (
    <section className="flex min-h-[32rem] flex-col rounded-[28px] border border-border/70 bg-card/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_50px_rgba(2,6,23,0.28)]">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[#4FB7B3]/12 text-[#2f9f9a] dark:bg-[#4FB7B3]/16 dark:text-[#79d8d4]">
            <MessageSquareText className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Chat</h2>
            <p className="text-sm text-muted-foreground">Ask questions, summarize, and steer the loop.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-6 p-5 sm:p-6">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {sessionState ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  <span>Active loop</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span>{sessionState.subject}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span>{sessionState.subtopic}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Chat requests are classified automatically, so normal questions and study actions can share one input.
                </p>
              </div>

              <div
                className={cn(
                  'rounded-2xl border px-4 py-3',
                  tokenWarningLevel === 'warning'
                    ? 'border-amber-500/25 bg-amber-500/10'
                    : tokenWarningLevel === 'watch'
                      ? 'border-[#4FB7B3]/25 bg-[#4FB7B3]/8'
                      : 'border-border bg-background/80',
                )}
              >
                <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  Token usage
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{tokenCount.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tokenWarningLevel === 'warning'
                    ? 'Near warning threshold'
                    : tokenWarningLevel === 'watch'
                      ? 'Compression may happen soon'
                      : 'Comfortable range'}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {transcriptMessages.length === 0 && !pendingQuestion ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/75 px-4 py-4 text-sm leading-7 text-muted-foreground">
                {isDisabled
                  ? 'Start the loop from Sources to unlock grounded chat.'
                  : 'Ask a question about the material or request a summary, memorables, or flashcards in natural language.'}
              </div>
            ) : null}

            {transcriptMessages.map((message) => {
              const isUser = message.role === 'user';
              const typeLabel = !isUser ? messageTypeLabel(message.type) : null;
              const isCompactAssistantEvent = !isUser && message.type && message.type !== 'answer';

              return (
                <div
                  key={`${message.timestamp}-${message.role}`}
                  className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-[24px] border px-4 py-3 shadow-sm',
                      isUser
                        ? 'border-[#4FB7B3]/30 bg-[#4FB7B3] text-white'
                        : isCompactAssistantEvent
                          ? 'border-[#4FB7B3]/18 bg-[#4FB7B3]/7 text-foreground'
                          : 'border-border bg-background text-foreground',
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-75">
                      {isUser ? <User className="size-3.5" /> : messageTypeIcon(message.type)}
                      <span>{isUser ? 'You' : 'LearnLoop'}</span>
                      {!isUser && typeLabel ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-current/40" />
                          <span>{typeLabel}</span>
                        </>
                      ) : null}
                      <span className="normal-case tracking-normal opacity-70">{formatTime(message.timestamp)}</span>
                    </div>
                    <p className="text-sm leading-7 whitespace-pre-wrap">{message.content}</p>
                    {!isUser && isCompactAssistantEvent ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Stored in loop state and kept compact in the transcript.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {pendingQuestion ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-[24px] border border-[#4FB7B3]/30 bg-[#4FB7B3] px-4 py-3 text-white shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-75">
                      <User className="size-3.5" />
                      <span>You</span>
                    </div>
                    <p className="text-sm leading-7 whitespace-pre-wrap">{pendingQuestion}</p>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-[24px] border border-border bg-background px-4 py-3 shadow-sm">
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      <Bot className="size-3.5" />
                      <span>LearnLoop</span>
                    </div>
                    {thinkingMessage ? (
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                        <LoaderCircle className="size-3.5 animate-spin" />
                        {thinkingMessage}
                      </div>
                    ) : null}
                    {streamedAssistantText.length > 0 ? (
                      <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">{streamedAssistantText}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {thinkingMessage ?? 'Waiting for the loop to respond'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {latestTopicShift?.shifted ? (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-900 dark:text-amber-100">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase">
                  <AlertCircle className="size-4" />
                  Topic shift
                </div>
                <p className="leading-7">
                  This request appears to move away from the active loop subject
                  <span className="mx-1 font-semibold">{sessionState?.subject ?? 'current loop'}</span>
                  toward
                  <span className="mx-1 font-semibold">{latestTopicShift.newSubject ?? 'a new subject'}</span>.
                </p>
              </div>
            ) : null}

            {latestResult && latestResult.intent !== 'qa' ? (
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  <span>{intentLabel(latestResult.intent)}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span>Latest result</span>
                </div>

                {latestResult.summary ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      The transcript keeps a compact confirmation while the full result stays in loop state for the tools panel.
                    </p>
                    <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">{latestResult.summary}</p>
                  </div>
                ) : null}

                {latestResult.memorables ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Memorables were generated without bloating the chat transcript.
                    </p>
                    <ul className="space-y-2 text-sm leading-7 text-foreground">
                      {latestResult.memorables.map((item) => (
                        <li key={item} className="rounded-xl border border-border bg-card px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {latestResult.flashcards ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Flashcards were saved to loop state; this preview keeps the chat readable.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {latestResult.flashcards.slice(0, 4).map((card, index) => (
                        <div key={`${card.front}-${index}`} className="rounded-xl border border-border bg-card px-3 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                            Front
                          </p>
                          <p className="mt-2 text-sm text-foreground">{card.front}</p>
                          <p className="mt-3 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                            Back
                          </p>
                          <p className="mt-2 text-sm text-foreground">{card.back}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div ref={transcriptEndRef} />
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/80 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              sessionState ? 'Ask a question' : 'Awaiting first source',
              'Summarize this loop',
              'Create flashcards',
            ].map((label) => (
              <span key={label} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {label}
              </span>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={isDisabled || isSubmitting}
              placeholder={
                isDisabled
                  ? 'Start the loop from Sources to begin chatting.'
                  : 'Ask about the material or request a summary, memorables, or flashcards.'
              }
              className="min-h-28 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-[#4FB7B3] focus:ring-4 focus:ring-[#4FB7B3]/15 disabled:cursor-not-allowed disabled:opacity-70"
            />

            {latestStatusNote ? (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-2xl px-3 py-2 text-sm',
                  latestStatusNote.includes('token budget')
                    ? 'border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100'
                    : 'border border-border bg-card text-muted-foreground',
                )}
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{latestStatusNote}</span>
              </div>
            ) : null}

            {chatError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {chatError}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {isDisabled
                  ? 'Chat stays disabled until the first source is started.'
                  : 'The ask route will classify intent, stream the result here, and keep non-QA outputs compact.'}
              </p>
              <Button
                type="submit"
                disabled={isDisabled || isSubmitting || question.trim().length === 0}
                className="h-10 rounded-full bg-[#4FB7B3] px-5 text-white hover:bg-[#399f9a]"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <SendHorizonal className="size-4" />
                    <ArrowRight className="size-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
