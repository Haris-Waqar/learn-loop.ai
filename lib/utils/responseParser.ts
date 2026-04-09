import { AppError } from './errorHandler';

/**
 * Safely parse a JSON string returned by the LLM.
 * Handles cases where the model wraps output in markdown code fences.
 */
export function parseJsonResponse<T>(raw: string): T {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AppError(`Failed to parse LLM JSON response: ${cleaned.slice(0, 200)}`, 500);
  }
}

/**
 * Extract a bullet-point list from a string.
 * Returns each bullet as a trimmed string without the leading marker.
 */
export function parseBulletList(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * Normalize LangChain chat model output into a plain string.
 */
export function getTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          'text' in part &&
          (part as { type?: string }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }

        return '';
      })
      .join('\n')
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  throw new AppError('LLM returned an unsupported response format.', 500);
}
