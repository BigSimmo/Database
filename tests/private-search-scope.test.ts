import { describe, expect, it } from "vitest";
import { persistPrivateSearchScope, restorePrivateSearchScope } from "../src/lib/private-search-scope";

const documentId = "11111111-1111-4111-8111-111111111111";
const scopeRef = "22222222-2222-4222-8222-222222222222";
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("private search scope", () => {
  it("restores validated document IDs for the same owner and session", () => {
    const storage = memoryStorage();
    expect(persistPrivateSearchScope(storage, "owner-a", [documentId], 100, () => scopeRef)).toBe(scopeRef);
    expect(restorePrivateSearchScope(storage, scopeRef, "owner-a", 200)).toEqual({
      kind: "restored",
      documentIds: [documentId],
    });
  });
  it("fails closed for missing, expired, malformed, and wrong-owner state", () => {
    const storage = memoryStorage();
    expect(restorePrivateSearchScope(storage, scopeRef, "owner-a", 100).kind).toBe("unavailable");
    persistPrivateSearchScope(storage, "owner-a", [documentId], 100, () => scopeRef);
    expect(restorePrivateSearchScope(storage, scopeRef, "owner-b", 200)).toEqual({
      kind: "unavailable",
      reason: "wrong_owner",
    });
    expect(restorePrivateSearchScope(storage, scopeRef, "owner-a", 30 * 60 * 1000 + 101)).toEqual({
      kind: "unavailable",
      reason: "expired",
    });
    expect(restorePrivateSearchScope(storage, "not-a-ref", "owner-a", 200)).toEqual({
      kind: "unavailable",
      reason: "invalid",
    });
  });
});
