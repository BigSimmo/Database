import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { useRegistryRecord, useRegistryRecords } from "@/lib/use-registry-records";

const authSession = vi.hoisted(() => ({
  authorizationHeader: { Authorization: "Bearer user-a-token" } as Record<string, string>,
  markSessionExpired: vi.fn(),
  session: { user: { id: "user-a" } } as { user: { id: string } } | null,
  status: "authenticated" as "loading" | "signed_out" | "authenticated" | "expired",
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

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  authSession.authorizationHeader = { Authorization: "Bearer user-a-token" };
  authSession.markSessionExpired.mockReset();
  authSession.session = { user: { id: "user-a" } };
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("auth-backed catalogue background refresh", () => {
  it("requests the selected lightweight projection", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ total: 54, verifiedCount: 42 }));

    const { result } = renderHook(() => useRegistryRecords("form", { view: "summary" }));
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/registry/records?kind=form&view=summary",
      expect.objectContaining({ headers: authSession.authorizationHeader }),
    );
    expect(result.current).toMatchObject({ status: "ready", records: [], total: 54, verifiedCount: 42 });
  });

  it("preserves registry rows for a same-user refresh and clears them immediately on identity change", async () => {
    const record = { slug: "cmht", title: "Community Mental Health Team" };
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [record], total: 1, verifiedCount: 0, governance: {} }));

    const { result, rerender } = renderHook(() => useRegistryRecords("service"));
    await flushMicrotasks();
    expect(result.current).toMatchObject({ status: "ready", records: [record], total: 1 });

    let resolveRefresh!: (response: Response) => void;
    let resolveNextIdentity!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRefresh = resolve)));
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveNextIdentity = resolve)));
    authSession.authorizationHeader = { Authorization: "Bearer user-a-refreshed" };
    rerender();
    expect(result.current).toMatchObject({ status: "refetching", records: [record], total: 1 });

    authSession.authorizationHeader = { Authorization: "Bearer user-b-token" };
    authSession.session = { user: { id: "user-b" } };
    rerender();
    expect(result.current).toMatchObject({ status: "loading", records: [], total: 0 });

    await act(async () =>
      resolveRefresh(jsonResponse({ records: [record], total: 1, verifiedCount: 0, governance: {} })),
    );
    await flushMicrotasks();
    expect(result.current).toMatchObject({ status: "loading", records: [], total: 0 });

    await act(async () =>
      resolveNextIdentity(jsonResponse({ records: [], total: 0, verifiedCount: 0, governance: {} })),
    );
    await flushMicrotasks();
    expect(result.current).toMatchObject({ status: "ready", records: [], total: 0 });
  });

  it("fails closed when a registry list returns malformed success data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: "not-an-array", total: 1, verifiedCount: 0 }));

    const { result } = renderHook(() => useRegistryRecords("service"));
    await flushMicrotasks();

    expect(result.current).toMatchObject({ status: "error", records: [], total: 0 });
  });

  it("fails closed when a registry detail omits its governance contract", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ record: { slug: "cmht", title: "Community Mental Health Team" }, linkedDocuments: [] }),
    );

    const { result } = renderHook(() => useRegistryRecord("service", "cmht"));
    await flushMicrotasks();

    expect(result.current).toMatchObject({ status: "error", record: null, linkedDocuments: [] });
  });

  it("preserves medication data only while query and identity are unchanged", async () => {
    vi.useFakeTimers();
    const payload = { records: [{ slug: "clozapine", name: "Clozapine" }], total: 1 };
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const { result, rerender } = renderHook(() => useMedicationCatalog("clozapine", { debounceMs: 0 }));
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(result.current).toMatchObject({ data: payload, loading: false, error: null });

    let resolveRefresh!: (response: Response) => void;
    let resolveNextIdentity!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRefresh = resolve)));
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveNextIdentity = resolve)));
    authSession.authorizationHeader = { Authorization: "Bearer user-a-refreshed" };
    rerender();
    expect(result.current).toMatchObject({ data: payload, loading: true, error: null });
    await act(async () => vi.runOnlyPendingTimersAsync());

    authSession.authorizationHeader = { Authorization: "Bearer user-b-token" };
    authSession.session = { user: { id: "user-b" } };
    rerender();
    expect(result.current).toMatchObject({ data: null, loading: true, error: null });
    await act(async () => vi.runOnlyPendingTimersAsync());

    await act(async () => resolveRefresh(jsonResponse(payload)));
    await flushMicrotasks();
    expect(result.current).toMatchObject({ data: null, loading: true, error: null });

    await act(async () => resolveNextIdentity(jsonResponse({ records: [], total: 0 })));
    await flushMicrotasks();
    expect(result.current).toMatchObject({ data: { records: [], total: 0 }, loading: false, error: null });
  });
});

// The suite above only ever walks user-a -> user-b with `authSession.status`
// pinned to "authenticated", so it never exercises the auth-status
// transitions this hook's identity fingerprint (`authSessionFingerprint`) is
// meant to cover: sign-out, session expiry, and the initial loading -> ready
// hydration race. Each transition below must drop the cached base catalogue
// (see `useMedicationCatalog`'s `baseCatalogueRef`) rather than let a
// previous auth state's cached rows leak into or hydrate the next one — the
// same privacy invariant the user-a/user-b test proves, extended to the
// transitions that invariant actually has to survive in production.
describe("useMedicationCatalog auth-status transitions", () => {
  afterEach(() => {
    // These tests mutate `status`, which the shared `beforeEach` above does
    // not reset — restore it so later tests in this file are not affected.
    authSession.status = "authenticated";
    authSession.session = { user: { id: "user-a" } };
    authSession.authorizationHeader = { Authorization: "Bearer user-a-token" };
  });

  it("drops the cached catalogue and refetches in full on sign-out, rather than reuse the signed-in user's cache", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [{ slug: "clozapine", name: "Clozapine" }], total: 1 }));
    const { result, rerender } = renderHook(() => useMedicationCatalog("clozapine", { debounceMs: 0 }));
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [], total: 0 }));
    authSession.status = "signed_out";
    authSession.session = null;
    authSession.authorizationHeader = {};
    rerender();
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    // Not "...&fields=index": a signed-out reader must never have ranked rows
    // hydrated against the previous session's cached catalogue.
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=clozapine",
      expect.objectContaining({ headers: {} }),
    );
    expect(result.current.data).toEqual({ records: [], total: 0 });
  });

  it("drops the cached catalogue and refetches in full when the session expires mid-session", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [{ slug: "clozapine", name: "Clozapine" }], total: 1 }));
    const { result, rerender } = renderHook(() => useMedicationCatalog("clozapine", { debounceMs: 0 }));
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [], total: 0 }));
    authSession.status = "expired";
    authSession.authorizationHeader = {};
    rerender();
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=clozapine",
      expect.objectContaining({ headers: {} }),
    );
    expect(result.current.data).toEqual({ records: [], total: 0 });
  });

  it("does not seed the cache from a loading-auth render, and re-seeds it for real once the session hydrates", async () => {
    vi.useFakeTimers();
    authSession.status = "loading";
    authSession.session = null;
    authSession.authorizationHeader = {};
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [], total: 0 }));

    const { result, rerender } = renderHook(() => useMedicationCatalog("clozapine", { debounceMs: 0 }));
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/medications?q=clozapine",
      expect.objectContaining({ headers: {} }),
    );

    authSession.status = "authenticated";
    authSession.session = { user: { id: "user-a" } };
    authSession.authorizationHeader = { Authorization: "Bearer user-a-token" };
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [{ slug: "clozapine", name: "Clozapine" }], total: 1 }));
    rerender();
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    // A different identity (now carrying real credentials) must re-seed the
    // cache from scratch — not "...&fields=index" against whatever the
    // anonymous, still-loading render saw.
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=clozapine",
      expect.objectContaining({ headers: { Authorization: "Bearer user-a-token" } }),
    );
    expect(result.current.data).toEqual({ records: [{ slug: "clozapine", name: "Clozapine" }], total: 1 });
  });
});
