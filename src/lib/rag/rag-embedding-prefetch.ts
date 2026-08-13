export type EmbeddingPrefetch<T> = {
  promise: Promise<T> | null;
  query: string | null;
};

/** Starts an optional query-embedding flight without changing the awaited retrieval path. */
export function prefetchEmbedding<T>(
  shouldPrefetch: boolean,
  query: string,
  createEmbedding: () => Promise<T>,
): EmbeddingPrefetch<T> {
  if (!shouldPrefetch) return { promise: null, query: null };

  let promise: Promise<T>;
  try {
    promise = Promise.resolve(createEmbedding());
  } catch (error) {
    promise = Promise.reject(error);
  }
  void promise.catch(() => undefined);
  return { promise, query };
}
