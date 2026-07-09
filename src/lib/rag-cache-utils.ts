/** Matches owner-scoped in-memory RAG cache keys (`rag-cache-v12|ownerId|...` and `ownerId|scope`). */
export function ragCacheKeyMatchesOwner(key: string, ownerId: string) {
  return key.includes(`|${ownerId}|`) || key.startsWith(`${ownerId}|`);
}
