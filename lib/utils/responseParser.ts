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
