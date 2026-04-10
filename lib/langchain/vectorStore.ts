/**
 * vectorStore.ts
 * Purpose: Embed material chunks, serialize to JSON for localStorage,
 *          and reconstruct MemoryVectorStore-compatible retrieval state from serialized vectors.
 * LangChain concepts: MemoryVectorStore, OpenAIEmbeddings, text splitter
 */
import type { SerializedVector } from '@/types/session';
import { CHUNK_OVERLAP, CHUNK_SIZE, EMBEDDING_MODEL } from '@/lib/constants';
import { AppError } from '@/lib/utils/errorHandler';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: EMBEDDING_MODEL,
});

// This method does the one-time preparation work for retrieval:
// it chunks the raw material, embeds each chunk, and returns a serializable payload
// that the client can store and send back on later requests.
export async function embedAndSerialize(material: string): Promise<SerializedVector[]> {
  const normalizedMaterial = material.trim();

  if (normalizedMaterial.length === 0) {
    throw new AppError('Study material is required to build session vectors.', 400);
  }

  // RecursiveCharacterTextSplitter splits text into overlapping character-based chunks.
  // Each chunk is of length `chunkSize`. The `chunkOverlap` parameter controls how many characters
  // from the end of one chunk are repeated at the beginning of the next chunk, which helps preserve context across chunk boundaries.
  // For example, if chunkSize = 10 and chunkOverlap = 3, the text "ABCDEFGHIJKLMN" would be split as:
  //   Chunk 0: "ABCDEFGHIJ"
  //   Chunk 1: "HIJKLMN"
  //       ("HIJ" overlaps with previous chunk)
  // This overlapping ensures information flows between chunks, improving the quality of downstream embeddings and retrieval.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  // Retrieval should be built from the original material, not from a later summary,
  // so downstream Q&A can still access details that summarization may compress away.
  // Split once on the server, then persist chunk text + embeddings so later requests can rebuild retrieval state.

  // This line splits the normalized study material into overlapping text chunks (documents),
  // attaching metadata to each chunk for provenance. Each chunked document will later be embedded.
  const documents = await splitter.createDocuments([normalizedMaterial], [
    { source: 'session-material' },
  ]);

  if (documents.length === 0) {
    throw new AppError('No material chunks were generated for embedding.', 500);
  }

  // Batch embedding keeps the serialized payload aligned with the generated chunk order.
  // It embeds all chunks in one API call, which is more efficient than embedding each chunk separately.
  const vectors = await embeddings.embedDocuments(documents.map((document) => document.pageContent));

  return documents.map((document, index) => ({
    pageContent: document.pageContent,
    metadata: {
      // chunkIndex gives us a stable ordering hint when reconstructing a store later.
      ...document.metadata,
      chunkIndex: index,
    },
    embedding: vectors[index] ?? [],
  }));
}

// This method is reserved for Phase 4, where serialized vectors from localStorage
// will be turned back into an in-memory retriever for similarity search during Q&A.
export async function reconstructVectorStore(
  serializedVectors: SerializedVector[],
): Promise<MemoryVectorStore> {
  if (!Array.isArray(serializedVectors) || serializedVectors.length === 0) {
    throw new AppError('Serialized vectors are required to reconstruct retrieval state.', 400);
  }

  const invalidVector = serializedVectors.find(
    (vector) =>
      !vector ||
      typeof vector.pageContent !== 'string' ||
      !Array.isArray(vector.embedding) ||
      typeof vector.metadata !== 'object' ||
      vector.metadata === null,
  );

  if (invalidVector) {
    throw new AppError('Serialized vectors are malformed.', 400);
  }

  // Rebuild the in-memory retriever from the client-persisted chunk texts and embeddings.
  const vectorStore = await MemoryVectorStore.fromExistingIndex(embeddings);
  const documents = serializedVectors.map(
    (vector) =>
      new Document({
        pageContent: vector.pageContent,
        metadata: vector.metadata,
      }),
  );

  await vectorStore.addVectors(
    serializedVectors.map((vector) => vector.embedding),
    documents,
  );

  return vectorStore;
}
