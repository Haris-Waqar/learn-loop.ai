/**
 * vectorStore.ts
 * Purpose: Embed material chunks, serialize to JSON for localStorage,
 *          and reconstruct DocArrayInMemorySearch from serialized vectors.
 * LangChain concepts: DocArrayInMemorySearch, OpenAIEmbeddings, text splitter
 */
import type { SerializedVector } from '@/types/session';

export async function embedAndSerialize(_material: string): Promise<SerializedVector[]> {
  // Phase 2 implementation
  throw new Error('embedAndSerialize not yet implemented');
}

export async function reconstructVectorStore(
  _serializedVectors: SerializedVector[],
): Promise<unknown> {
  // Phase 4 implementation — returns DocArrayInMemorySearch instance
  throw new Error('reconstructVectorStore not yet implemented');
}
