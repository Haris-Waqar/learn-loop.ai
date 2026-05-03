import type { ApiResponse, Flashcard, SessionState } from '@/types/session';

interface SummaryStreamHandlers {
  onThinking?: (message: string) => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (summary: string) => void;
  onError?: (message: string) => void;
}

function dispatchSummaryEvent(eventName: string, rawData: string, handlers: SummaryStreamHandlers) {
  if (eventName === 'thinking') {
    handlers.onThinking?.(JSON.parse(rawData) as string);
    return;
  }

  if (eventName === 'chunk') {
    handlers.onChunk?.(JSON.parse(rawData) as string);
    return;
  }

  if (eventName === 'complete') {
    handlers.onComplete?.(JSON.parse(rawData) as string);
    return;
  }

  if (eventName === 'error') {
    handlers.onError?.(JSON.parse(rawData) as string);
  }
}

async function parseSseStream(
  response: Response,
  handlers: SummaryStreamHandlers,
) {
  if (!response.body) {
    throw new Error('The stream did not return a readable body.');
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  let buffer = '';
  let currentEvent = 'message';
  let currentData: string[] = [];

  function flushCurrentEvent() {
    if (currentData.length === 0) {
      currentEvent = 'message';
      return;
    }

    dispatchSummaryEvent(currentEvent, currentData.join('\n'), handlers);
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

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? 'Tool request failed.');
  }

  return payload.data;
}

export async function streamSummaryTool(sessionState: SessionState, handlers: SummaryStreamHandlers) {
  const response = await fetch('/api/session/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      material: sessionState.material,
      persona: sessionState.persona,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as ApiResponse<null>;
    throw new Error(payload.error ?? 'Failed to generate the summary.');
  }

  await parseSseStream(response, handlers);
}

export async function runMemorablesTool(sessionState: SessionState) {
  const response = await fetch('/api/session/memorables', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      material: sessionState.material,
      summary: sessionState.summary,
      recentMessages: sessionState.recentMessages,
      rollingSum: sessionState.rollingSum,
      persona: sessionState.persona,
    }),
  });

  return parseJsonResponse<{ memorables: string[] }>(response);
}

export async function runFlashcardsTool(sessionState: SessionState) {
  const response = await fetch('/api/session/flashcards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      material: sessionState.material,
      summary: sessionState.summary,
      memorables: sessionState.memorables,
      recentMessages: sessionState.recentMessages,
      rollingSum: sessionState.rollingSum,
      persona: sessionState.persona,
    }),
  });

  return parseJsonResponse<{ flashcards: Flashcard[] }>(response);
}

export async function runHandoffTool(sessionState: SessionState) {
  const response = await fetch('/api/session/handoff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      material: sessionState.material,
      summary: sessionState.summary,
      recentMessages: sessionState.recentMessages,
      rollingSum: sessionState.rollingSum,
      persona: sessionState.persona,
    }),
  });

  return parseJsonResponse<{ handoffSummary: string }>(response);
}
