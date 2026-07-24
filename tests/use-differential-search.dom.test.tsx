import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDifferentialSearchCacheForTests,
  useDifferentialSearch,
} from "@/components/clinical-dashboard/use-differential-catalog";

const authSession = vi.hoisted(() => ({
  authorizationHeader: { Authorization: "Bearer differential-search-test" },
  markSessionExpired: vi.fn(),
  status: "authenticated" as const,
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => authSession,
}));

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.useFakeTimers();
  clearDifferentialSearchCacheForTests();
  authSession.markSessionExpired.mockReset();
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearDifferentialSearchCacheForTests();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function advanceDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useDifferentialSearch debounce/abort/cache", () => {
  it("debounces fetches, aborts superseded keystrokes, and serves LRU cache hits", async () => {
    const diagnosisMatch = {
      record: { slug: "major-depressive-disorder", title: "Major depressive disorder" },
      score: 12,
      reasons: ["title"],
    };
    const presentationMatch = {
      workflow: { slug: "low-mood", title: "Low mood" },
      score: 9,
      reasons: ["title"],
    };
    const requestSignals: AbortSignal[] = [];
    fetchMock.mockImplementation((_input, init) => {
      requestSignals.push(init?.signal as AbortSignal);
      const url = String(_input);
      if (url.includes("kind=diagnosis")) {
        return Promise.resolve(jsonResponse({ matches: [diagnosisMatch], demoMode: true }));
      }
      return Promise.resolve(jsonResponse({ matches: [presentationMatch], demoMode: true }));
    });

    const { result, rerender } = renderHook(({ query }) => useDifferentialSearch(query), {
      initialProps: { query: "dep" },
    });
    expect(result.current.status).toBe("loading");
    expect(fetchMock).not.toHaveBeenCalled();

    await advanceDebounce();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({
      status: "ready",
      demoMode: true,
      matches: {
        diagnoses: [diagnosisMatch],
        presentations: [presentationMatch],
      },
    });

    rerender({ query: "depre" });
    expect(result.current.status).toBe("loading");
    await flushMicrotasks();
    expect(requestSignals[0]?.aborted).toBe(true);
    expect(requestSignals[1]?.aborted).toBe(true);

    await advanceDebounce();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.current.status).toBe("ready");

    // Revisiting the first query hits the auth-keyed LRU and skips the network.
    const callsBeforeCacheHit = fetchMock.mock.calls.length;
    rerender({ query: "dep" });
    await flushMicrotasks();
    await advanceDebounce();
    await flushMicrotasks();
    expect(fetchMock.mock.calls.length).toBe(callsBeforeCacheHit);
    expect(result.current).toMatchObject({
      status: "ready",
      matches: {
        diagnoses: [diagnosisMatch],
        presentations: [presentationMatch],
      },
    });
  });

  it("does not fetch for empty queries", async () => {
    const { result } = renderHook(() => useDifferentialSearch("   "));
    await advanceDebounce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      status: "ready",
      matches: { diagnoses: [], presentations: [] },
      demoMode: false,
    });
  });
});
