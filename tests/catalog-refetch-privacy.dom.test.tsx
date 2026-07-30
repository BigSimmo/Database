import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import { useRegistryRecords } from "@/lib/use-registry-records";

const authSession = vi.hoisted(() => ({
  authorizationHeader: { Authorization: "Bearer user-a-token" },
  markSessionExpired: vi.fn(),
  session: { user: { id: "user-a" } },
  status: "authenticated" as const,
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
  it("preserves registry rows for a same-user refresh and clears them immediately on identity change", async () => {
    const record = { slug: "cmht", title: "Community Mental Health Team" };
    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [record], total: 1, governance: {} }));

    const { result, rerender } = renderHook(() => useRegistryRecords("service"));
    await flushMicrotasks();
    expect(result.current).toMatchObject({ status: "ready", records: [record], total: 1 });

    let resolveRefresh!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRefresh = resolve)));
    authSession.authorizationHeader = { Authorization: "Bearer user-a-refreshed" };
    rerender();
    expect(result.current).toMatchObject({ status: "refetching", records: [record], total: 1 });

    await act(async () => resolveRefresh(jsonResponse({ records: [record], total: 1, governance: {} })));
    await flushMicrotasks();
    expect(result.current.status).toBe("ready");

    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined));
    authSession.authorizationHeader = { Authorization: "Bearer user-b-token" };
    authSession.session = { user: { id: "user-b" } };
    rerender();
    expect(result.current).toMatchObject({ status: "loading", records: [], total: 0 });
  });

  it("preserves medication data only while query and identity are unchanged", async () => {
    vi.useFakeTimers();
    const payload = { records: [{ slug: "clozapine", name: "Clozapine" }], total: 1 };
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const { result, rerender } = renderHook(() => useMedicationCatalog("clozapine", { debounceMs: 0 }));
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(result.current).toMatchObject({ data: payload, loading: false, error: null });

    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => undefined));
    authSession.authorizationHeader = { Authorization: "Bearer user-a-refreshed" };
    rerender();
    expect(result.current).toMatchObject({ data: payload, loading: true, error: null });

    authSession.authorizationHeader = { Authorization: "Bearer user-b-token" };
    authSession.session = { user: { id: "user-b" } };
    rerender();
    expect(result.current).toMatchObject({ data: null, loading: true, error: null });
  });
});
