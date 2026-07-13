const storagePrefix = "clinical.private-search-scope.";
export const privateSearchScopeTtlMs = 30 * 60 * 1000;
const maxDocumentIds = 25;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredPrivateSearchScope = { version: 1; ownerId: string; documentIds: string[]; expiresAt: number };
export type PrivateSearchScopeRestore =
  | { kind: "restored"; documentIds: string[] }
  | { kind: "unavailable"; reason: "missing" | "invalid" | "expired" | "wrong_owner" };

export function persistPrivateSearchScope(
  storage: Pick<Storage, "setItem">,
  ownerId: string,
  documentIds: string[],
  now = Date.now(),
  createRef: () => string = () => crypto.randomUUID(),
) {
  const validated = Array.from(new Set(documentIds))
    .filter((id) => uuidPattern.test(id))
    .slice(0, maxDocumentIds);
  if (!ownerId || validated.length === 0) return null;
  const scopeRef = createRef();
  if (!uuidPattern.test(scopeRef)) return null;
  const value: StoredPrivateSearchScope = {
    version: 1,
    ownerId,
    documentIds: validated,
    expiresAt: now + privateSearchScopeTtlMs,
  };
  storage.setItem(`${storagePrefix}${scopeRef}`, JSON.stringify(value));
  return scopeRef;
}

export function restorePrivateSearchScope(
  storage: Pick<Storage, "getItem" | "removeItem">,
  scopeRef: string,
  ownerId: string,
  now = Date.now(),
): PrivateSearchScopeRestore {
  if (!uuidPattern.test(scopeRef)) return { kind: "unavailable", reason: "invalid" };
  const key = `${storagePrefix}${scopeRef}`;
  const raw = storage.getItem(key);
  if (!raw) return { kind: "unavailable", reason: "missing" };
  try {
    const value = JSON.parse(raw) as Partial<StoredPrivateSearchScope>;
    if (
      value.version !== 1 ||
      !Array.isArray(value.documentIds) ||
      value.documentIds.length === 0 ||
      value.documentIds.length > maxDocumentIds ||
      value.documentIds.some((id) => typeof id !== "string" || !uuidPattern.test(id)) ||
      typeof value.expiresAt !== "number"
    ) {
      storage.removeItem(key);
      return { kind: "unavailable", reason: "invalid" };
    }
    if (value.expiresAt <= now) {
      storage.removeItem(key);
      return { kind: "unavailable", reason: "expired" };
    }
    if (value.ownerId !== ownerId) return { kind: "unavailable", reason: "wrong_owner" };
    return { kind: "restored", documentIds: [...new Set(value.documentIds)] };
  } catch {
    storage.removeItem(key);
    return { kind: "unavailable", reason: "invalid" };
  }
}
