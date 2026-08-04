/** Matches owner-scoped in-memory RAG cache keys, including owner-plus-public scope keys. */
export function ragCacheKeyMatchesOwner(key: string, ownerId: string) {
  return (
    key.includes(`|${ownerId}|`) ||
    key.startsWith(`${ownerId}|`) ||
    key.includes(`|owner:${ownerId}+public|`) ||
    key.startsWith(`owner:${ownerId}+public|`)
  );
}
