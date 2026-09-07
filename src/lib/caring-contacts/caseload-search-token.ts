// src/lib/caring-contacts/caseload-search-token.ts
//
// Obfuscated session filter tokens for Caring Contacts caseload search (#HDCF2B).
//
// Prevents raw patient health information (PHI) and names from appearing in browser history,
// referer headers, or server access logs by replacing plaintext query parameters with
// opaque session filter tokens.
//
// Complies with Ruling [111]: "a query string is logged by every proxy between here and the browser.
// Nothing about a patient may travel here."

import { randomBytes } from "node:crypto";

const TOKEN_PREFIX = "sft_";
export const DEFAULT_SEARCH_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

type TokenEntry = {
  query: string;
  expiresAt: number;
};

const tokenStore = new Map<string, TokenEntry>();

/**
 * Prunes expired tokens from the ephemeral store.
 */
function pruneExpiredTokens(now: number = Date.now()): void {
  for (const [token, entry] of tokenStore.entries()) {
    if (now > entry.expiresAt) {
      tokenStore.delete(token);
    }
  }
}

/**
 * Creates an obfuscated session filter token for a search query.
 * Produces an opaque, random token that contains ZERO patient identifiers or PHI.
 */
export function createSearchFilterToken(query: string, options?: { ttlMs?: number; now?: number }): string {
  const trimmed = query.trim();
  if (trimmed === "") return "";

  const now = options?.now ?? Date.now();
  pruneExpiredTokens(now);

  const ttlMs = options?.ttlMs ?? DEFAULT_SEARCH_TOKEN_TTL_MS;
  const id = randomBytes(16).toString("hex");
  const token = `${TOKEN_PREFIX}${id}`;

  tokenStore.set(token, {
    query: trimmed,
    expiresAt: now + ttlMs,
  });

  return token;
}

/**
 * Resolves an obfuscated session filter token back into the search string.
 * Returns null if the token is invalid, expired, malformed, or empty.
 */
export function resolveSearchFilterToken(token: string | null | undefined, options?: { now?: number }): string | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;

  const now = options?.now ?? Date.now();
  const entry = tokenStore.get(token);

  if (!entry) {
    return null;
  }

  if (now > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }

  return entry.query;
}

/**
 * Returns true if a string matches the format of an obfuscated search filter token
 * and resolves to a valid active search query.
 */
export function isSearchFilterToken(value: unknown, options?: { now?: number }): boolean {
  if (typeof value !== "string" || !value.startsWith(TOKEN_PREFIX)) return false;
  return resolveSearchFilterToken(value, options) !== null;
}

/**
 * Clears all tokens from the ephemeral store (primarily for test isolation).
 */
export function clearSearchFilterTokenStore(): void {
  tokenStore.clear();
}
