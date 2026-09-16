import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registryCatalogueSlowNoticeMs, useRegistryRecords } from "@/lib/use-registry-records";

// #issue: the registry list fetch (Services/Forms browse and search) had no
// timer at all, so a long wait left an unchanging spinner on screen — "not
// loading" as reported, even though the request was still genuinely running.
// This mirrors the pattern already proven for /api/search
// (`createSearchRequestDeadline`, search-utils.ts) at a shorter threshold
// sized to this route's own measured production latency (4.5-6.5s).

const authSession = vi.hoisted(() => ({
  authorizationHeader: { Authorization: "Bearer user-a-token" } as Record<string, string>,
  markSessionExpired: vi.fn(),
  session: { user: { id: "user-a" } } as { user: { id: string } } | null,
  status: "authenticated" as "loading" | "authenticated",
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => authSession,
}));

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  authSession.authorizationHeader = { Authorization: "Bearer user-a-token" };
  authSession.markSessionExpired.mockReset();
  authSession.session = { user: { id: "user-a" } };
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useRegistryRecords slow notice", () => {
  it("flags the initial load as slow once it outruns the threshold, and clears the flag once it resolves", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));

    const { result } = renderHook(() => useRegistryRecords("service"));
    expect(result.current.status).toBe("loading");
    expect(result.current.slow).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(registryCatalogueSlowNoticeMs - 1));
    expect(result.current.slow).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.slow).toBe(true);

    await act(async () => resolveFetch(jsonResponse({ records: [], total: 0, verifiedCount: 0, governance: {} })));
    await act(async () => vi.advanceTimersByTimeAsync(0));

    expect(result.current.status).toBe("ready");
    expect(result.current.slow).toBe(false);
  });

  it("clears the slow-notice timer on a 401 received while auth is still loading, instead of letting it fire later", async () => {
    // #issue F9: the 401 branch used to check `authStatus === "loading"` and
    // `return` BEFORE clearing `slowTimer`, so a definitive 401 that arrived
    // while auth was still resolving left the timer running. If auth then
    // took longer than `registryCatalogueSlowNoticeMs` to settle, the reader
    // saw "this is taking longer than usual" for a request that had already
    // finished — the wrong notice for an auth race, not a slow server.
    authSession.status = "loading";
    try {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));

      const { result } = renderHook(() => useRegistryRecords("service"));
      await act(async () => vi.runOnlyPendingTimersAsync());
      // Still loading — a 401 while auth itself is loading must never expire
      // the session; it waits for a real header and retries.
      expect(result.current.status).toBe("loading");

      await act(async () => vi.advanceTimersByTimeAsync(registryCatalogueSlowNoticeMs + 1_000));
      expect(result.current.slow).toBe(false);
    } finally {
      authSession.status = "authenticated";
    }
  });

  it("never raises the slow flag on a background refetch that already has a trustworthy list on screen", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [], total: 0, verifiedCount: 0, governance: {} }));
    const { result, rerender } = renderHook(() => useRegistryRecords("service"));
    await act(async () => vi.runOnlyPendingTimersAsync());
    expect(result.current.status).toBe("ready");

    let resolveRefetch!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRefetch = resolve)));
    authSession.authorizationHeader = { Authorization: "Bearer user-a-refreshed" };
    rerender();
    expect(result.current.status).toBe("refetching");

    await act(async () => vi.advanceTimersByTimeAsync(registryCatalogueSlowNoticeMs + 1_000));
    expect(result.current.slow).toBe(false); // nothing to reassure — the prior list is still on screen

    await act(async () => resolveRefetch(jsonResponse({ records: [], total: 0, verifiedCount: 0, governance: {} })));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.status).toBe("ready");
  });
});
