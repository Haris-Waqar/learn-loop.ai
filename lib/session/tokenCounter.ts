import { MAX_TOKENS, TOKEN_COMPRESS_THRESHOLD, TOKEN_WARNING_THRESHOLD } from '@/lib/constants';
import type { Message } from '@/types/session';

/**
 * Rough token estimate: ~4 characters per token (OpenAI approximation).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

export function getTokenUsageRatio(tokenCount: number): number {
  return tokenCount / MAX_TOKENS;
}

export function shouldCompress(tokenCount: number): boolean {
  return getTokenUsageRatio(tokenCount) >= TOKEN_COMPRESS_THRESHOLD;
}

export function shouldWarn(tokenCount: number): boolean {
  return getTokenUsageRatio(tokenCount) >= TOKEN_WARNING_THRESHOLD;
}
