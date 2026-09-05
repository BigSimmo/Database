/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import {
  cacheOnCallEntries,
  clearOnCallEntryCache,
  readCachedOnCallEntries,
  useOnCallEntries,
} from "@/lib/on-call/entry-store";

const contact: OnCallEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  section: "contacts",
  slug: "ed-registrar-after-hours",
  title: "ED Registrar (after hours)",
  subtitle: null,
  body: null,
  details: { role: "After-hours ED registrar", phone: "0400 111 222" },
  linkedDocumentIds: [],
  tags: [],
  isPersonal: false,
  includeOnCard: true,
  sortOrder: 0,
  lastVerifiedAt: "2026-08-01T00:00:00.000Z",
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("useOnCallEntries", () => {
  beforeEach(() => {
    clearOnCallEntryCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearOnCallEntryCache();
    vi.restoreAllMocks();
  });

  it("writes the cache and records the save time on a successful fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entries: [contact], signedOut: false }));

    const { result } = renderHook(() => useOnCallEntries());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isOffline).toBe(false);
    expect(result.current.entries).toEqual([contact]);
    expect(result.current.cachedAt).not.toBeNull();

    // The write actually reached the durable cache, not just component state.
    const cached = readCachedOnCallEntries();
    expect(cached?.entries).toEqual([contact]);
    expect(cached?.savedAt).toBe(result.current.cachedAt);
  });

  it("renders the cached copy, with its saved date, when the fetch fails", async () => {
    cacheOnCallEntries([contact]);
    const savedAt = readCachedOnCallEntries()?.savedAt;
    expect(savedAt).toBeTruthy();

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useOnCallEntries());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isOffline).toBe(true);
    expect(result.current.entries).toEqual([contact]);
    // The saved date is available to the UI even though the network is down.
    expect(result.current.cachedAt).toBe(savedAt);
  });

  // On Call entries became readable by any visitor on 2026-09-04, so a signed-out response
  // now carries the shared set and IS worth caching. What still must not happen is an empty
  // response erasing a good cache mid-shift — the reason the old signed-out guard existed.
  it("caches a signed-out response, because it now carries the shared entries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entries: [contact], signedOut: true }));

    const { result } = renderHook(() => useOnCallEntries());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.signedOut).toBe(true);
    expect(result.current.entries).toEqual([contact]);
    expect(readCachedOnCallEntries()?.entries).toEqual([contact]);
  });

  it("does not let an empty response erase a non-empty cache", async () => {
    cacheOnCallEntries([contact]);
    const cachedBefore = readCachedOnCallEntries();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entries: [], signedOut: true }));

    const { result } = renderHook(() => useOnCallEntries());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The stale-but-real cache is still shown rather than blanked.
    expect(result.current.entries).toEqual([contact]);
    expect(readCachedOnCallEntries()).toEqual(cachedBefore);
  });

  it("clears on demand", () => {
    cacheOnCallEntries([contact]);
    expect(readCachedOnCallEntries()).not.toBeNull();

    clearOnCallEntryCache();

    expect(readCachedOnCallEntries()).toBeNull();
  });

  it("survives a storage accessor that throws, returning an empty list rather than propagating", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    let hook: ReturnType<typeof renderHook<ReturnType<typeof useOnCallEntries>, unknown>> | undefined;
    expect(() => {
      hook = renderHook(() => useOnCallEntries());
    }).not.toThrow();

    await waitFor(() => expect(hook?.result.current.loading).toBe(false));

    expect(hook?.result.current.entries).toEqual([]);
    expect(hook?.result.current.cachedAt).toBeNull();
  });
});
