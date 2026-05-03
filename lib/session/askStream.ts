import type { ApiResponse, AskCompleteEvent, SessionState } from '@/types/session';

interface AskLoopHandlers {
  onThinking?: (message: string) => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (event: AskCompleteEvent) => void;
  onError?: (message: string) => void;
}

interface AskLoopInput extends AskLoopHandlers {
  question: string;
  sessionState: SessionState;
  signal?: AbortSignal;
}

function dispatchEvent(eventName: string, rawData: string, handlers: AskLoopHandlers) {
  if (eventName === 'thinking') {
    handlers.onThinking?.(JSON.parse(rawData) as string);
    return;
  }

  if (eventName === 'chunk') {
    handlers.onChunk?.(JSON.parse(rawData) as string);
    return;
  }

  if (eventName === 'complete') {
    handlers.onComplete?.(JSON.parse(rawData) as AskCompleteEvent);
    return;
  }

  if (eventName === 'error') {
    handlers.onError?.(JSON.parse(rawData) as string);
  }
}

export async function streamAskLoop({
  question,
  sessionState,
  signal,
  onThinking,
  onChunk,
  onComplete,
  onError,
}: AskLoopInput) {
  const response = await fetch('/api/session/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      material: sessionState.material,
      summary: sessionState.summary,
      memorables: sessionState.memorables,
      persona: sessionState.persona,
      currentSubject: sessionState.subject,
      currentSubtopic: sessionState.subtopic,
      recentMessages: sessionState.recentMessages,
      rollingSum: sessionState.rollingSum,
      serializedVectors: sessionState.serializedVectors,
    }),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json()) as ApiResponse<null>;
    throw new Error(payload.error ?? 'Failed to ask the loop.');
  }

  if (!response.body) {
    throw new Error('Ask stream did not return a readable body.');
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  const handlers = { onThinking, onChunk, onComplete, onError };

  let buffer = '';
  let currentEvent = 'message';
  let currentData: string[] = [];

  function flushCurrentEvent() {
    if (currentData.length === 0) {
      currentEvent = 'message';
      return;
    }

    dispatchEvent(currentEvent, currentData.join('\n'), handlers);
    currentEvent = 'message';
    currentData = [];
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let lineBreakIndex = buffer.indexOf('\n');
    while (lineBreakIndex !== -1) {
      const rawLine = buffer.slice(0, lineBreakIndex);
      buffer = buffer.slice(lineBreakIndex + 1);
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (line.length === 0) {
        flushCurrentEvent();
      } else if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentData.push(line.slice(5).trimStart());
      }

      lineBreakIndex = buffer.indexOf('\n');
    }

    if (done) {
      if (buffer.length > 0) {
        const trailingLine = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
        if (trailingLine.startsWith('data:')) {
          currentData.push(trailingLine.slice(5).trimStart());
        }
      }

      flushCurrentEvent();
      break;
    }
  }
}
