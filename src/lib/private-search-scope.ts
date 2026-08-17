import { z } from "zod";

const storagePrefix = "clinical.private-search-scope.";
export const privateSearchScopeTtlMs = 30 * 60 * 1000;
const maxDocumentIds = 25;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const storedPrivateSearchScopeSchema = z.object({
  version: z.literal(1),
  ownerId: z.string().min(1),
  documentIds: z.array(z.string().regex(uuidPattern)).min(1).max(maxDocumentIds),
  expiresAt: z.number(),
});

type StoredPrivateSearchScope = z.infer<typeof storedPrivateSearchScopeSchema>;

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
  try {
    storage.setItem(`${storagePrefix}${scopeRef}`, JSON.stringify(value));
    return scopeRef;
  } catch {
    // Browser privacy settings, quota exhaustion, or disabled storage should
    // remove only URL restoration, not prevent the scoped request itself.
    return null;
  }
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
    const rawJson = JSON.parse(raw);
    const parsed = storedPrivateSearchScopeSchema.safeParse(rawJson);
    if (!parsed.success) {
      storage.removeItem(key);
      return { kind: "unavailable", reason: "invalid" };
    }
    const value = parsed.data;
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

/** Drop a restored private-scope ref from the current URL without a navigation. */
export function removePrivateScopeRefFromUrl(
  location: Pick<Location, "pathname" | "search" | "hash"> = window.location,
) {
  const params = new URLSearchParams(location.search);
  params.delete("scopeRef");
  const next = params.toString();
  window.history.replaceState(null, "", `${location.pathname}${next ? `?${next}` : ""}${location.hash}`);
}
