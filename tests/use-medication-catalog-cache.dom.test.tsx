import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMedicationCatalog } from "@/components/clinical-dashboard/use-medication-catalog";
import type { MedicationRecord } from "@/lib/medications";
import { siteContentRecordCacheTtlMs } from "@/lib/site-content/site-content-record-cache";

// The 2026-09 latency audit: `/api/medications` returns the full 2.47 MB
// catalogue on every debounced keystroke because the hook passed no `fields`,
// regardless of whether the query changed the answer at all. This suite
// exercises the client-side fix — cache the query-independent catalogue once,
// ask for the compact `fields=index` projection on every later query, and
// hydrate the ranked rows back to full detail locally — without touching the
// route's response contract.

const authSession = vi.hoisted(() => ({
  authorizationHeader: { Authorization: "Bearer user-a-token" } as Record<string, string>,
  session: { user: { id: "user-a" } } as { user: { id: string } } | null,
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

// The full, richly-detailed catalogue record — what the safety/monitoring
// chips and patient-alert engines need (medication-prescribing-workspace.tsx),
// and what the very first (no-cache-yet) fetch always returns in full.
const fullClozapine: MedicationRecord = {
  slug: "clozapine",
  name: "Clozapine",
  class: "Antipsychotic",
  subclass: "Atypical",
  category: "Antipsychotic",
  accent: "teal",
  tag: "Second-line",
  schedule: "S4",
  stats: [{ label: "Max dose", value: "900 mg/day" }],
  sections: [],
  quick: [
    { label: "Usual dose", value: "12.5 mg" },
    { label: "Avoid", value: "Abrupt cessation" },
  ],
};

// What `toIndexRecords` (medications/route.ts) strips a record down to for
// `fields=index`: identity fields only, no stats/sections/quick.
const indexClozapine: MedicationRecord = {
  slug: "clozapine",
  name: "Clozapine",
  class: "Antipsychotic",
  subclass: "Atypical",
  category: "Antipsychotic",
  accent: "teal",
  tag: "Second-line",
  schedule: "S4",
  stats: [],
  sections: [],
  quick: [],
};

function fullFetchResponse() {
  return jsonResponse({
    records: [fullClozapine],
    matches: [
      {
        medication: fullClozapine,
        score: 20,
        reasons: ["name"],
        result: {
          id: "clozapine",
          name: "Clozapine",
          indication: "Atypical",
          match: "Exact clinical fit",
          dose: "12.5 mg",
          ceiling: "900 mg/day",
          action: "Avoid abrupt cessation",
          actionTone: "danger",
          tone: "teal",
          href: "/medications/clozapine",
        },
      },
    ],
    total: 1,
    governance: { clozapine: { sourceStatus: "current", validationStatus: "approved" } },
  });
}

// Simulates a smart-alias-only hit: the route computed `result` against a
// zeroed score (`queryIncludesMedicationIdentity` was false), so `match`/`tone`
// read as a weak match even though the raw `score` beside it is high. The
// index response also carries the stripped-down record and the generic
// dose/ceiling/action text that follows from having no stats/sections/quick.
function indexFetchResponse() {
  return jsonResponse({
    records: [indexClozapine],
    matches: [
      {
        medication: indexClozapine,
        score: 20,
        reasons: ["expanded"],
        result: {
          id: "clozapine",
          name: "Clozapine",
          indication: "Atypical",
          match: "Related match",
          dose: "See dosing",
          ceiling: "See reference",
          action: "Review full prescribing reference",
          actionTone: "neutral",
          tone: "slate",
          href: "/medications/clozapine",
        },
      },
    ],
    total: 1,
    governance: { clozapine: { sourceStatus: "current", validationStatus: "approved" } },
  });
}

beforeEach(() => {
  authSession.authorizationHeader = { Authorization: "Bearer user-a-token" };
  authSession.session = { user: { id: "user-a" } };
  authSession.status = "authenticated";
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useMedicationCatalog query-independent catalogue cache", () => {
  it("fetches the catalogue in full on the first request, then the compact projection on later queries", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(fullFetchResponse());

    const { result, rerender } = renderHook(({ query }) => useMedicationCatalog(query, { debounceMs: 0 }), {
      initialProps: { query: "cloz" },
    });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/medications?q=cloz",
      expect.objectContaining({ headers: authSession.authorizationHeader }),
    );
    expect(result.current.data?.records).toEqual([fullClozapine]);

    fetchMock.mockResolvedValueOnce(indexFetchResponse());
    rerender({ query: "clozapine" });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=clozapine&fields=index",
      expect.objectContaining({ headers: authSession.authorizationHeader }),
    );

    const match = result.current.data?.matches?.[0];
    expect(match?.medication).toEqual(fullClozapine); // hydrated back to full detail
    // Non-score-dependent fields are recomputed from the full record rather
    // than left at the slim projection's generic fallback text.
    expect(match?.result.dose).toBe("12.5 mg");
    expect(match?.result.ceiling).toBe("900 mg/day");
    expect(match?.result.action).toBe("Abrupt cessation");
    // `match`/`tone` are the one thing NOT recomputed from the (high, raw)
    // score: the server already zeroed them for this hit, and re-deriving
    // them from the full record + raw score would silently drop that.
    expect(match?.result.match).toBe("Related match");
    expect(match?.result.tone).toBe("slate");
    // The trailing catalogue-only rows read `data.records`, which must stay
    // the cached full catalogue, not the slim per-query one.
    expect(result.current.data?.records).toEqual([fullClozapine]);
  });

  it("serves the cached catalogue with no network request once the query is cleared", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(fullFetchResponse());
    const { result, rerender } = renderHook(({ query }) => useMedicationCatalog(query, { debounceMs: 0 }), {
      initialProps: { query: "cloz" },
    });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ query: "" });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1); // no second request for the empty-query view
    expect(result.current.data?.matches).toBeUndefined();
    expect(result.current.data?.records).toEqual([fullClozapine]);
    expect(result.current.loading).toBe(false);
  });

  it("discards the cached catalogue and refetches in full when the signed-in identity changes", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(fullFetchResponse());
    const { result, rerender } = renderHook(({ query }) => useMedicationCatalog(query, { debounceMs: 0 }), {
      initialProps: { query: "cloz" },
    });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ records: [], total: 0 }));
    authSession.authorizationHeader = { Authorization: "Bearer user-b-token" };
    authSession.session = { user: { id: "user-b" } };
    rerender({ query: "cloz" });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    // Not `...&fields=index` — a different identity has no cached base yet, so
    // this request must be able to stand on its own and re-seed the cache.
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=cloz",
      expect.objectContaining({ headers: { Authorization: "Bearer user-b-token" } }),
    );
    expect(result.current.data).toEqual({ records: [], total: 0 });
  });

  it("shows a slow notice once the request outruns the threshold, and clears it once the response lands", async () => {
    vi.useFakeTimers();
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));

    const { result } = renderHook(() => useMedicationCatalog("cloz", { debounceMs: 0 }));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.slow).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    expect(result.current.slow).toBe(true);

    await act(async () => resolveFetch(fullFetchResponse()));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.slow).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});

// A second full record, for the F3 TTL suite's "the server's answer changed
// while the cache was stale" scenario.
const fullLithium: MedicationRecord = {
  slug: "lithium",
  name: "Lithium",
  class: "Mood stabiliser",
  subclass: "Mood stabiliser",
  category: "Mood stabiliser",
  accent: "blue",
  tag: "",
  schedule: "S4",
  stats: [{ label: "Max dose", value: "1.2 mmol/L" }],
  sections: [],
  quick: [],
};

function lithiumMatchPayload() {
  return {
    medication: fullLithium,
    score: 15,
    reasons: ["name"],
    result: {
      id: "lithium",
      name: "Lithium",
      indication: "Bipolar maintenance",
      match: "Exact clinical fit",
      dose: "400 mg",
      ceiling: "1.2 mmol",
      action: "Monitor serum levels",
      actionTone: "warning",
      tone: "blue",
      href: "/medications/lithium",
    },
  };
}

describe("useMedicationCatalog — F1 self-healing hydration miss", () => {
  it("marks a ranked match unhydrated when its slug is missing from the cache, then self-heals with a transient full re-fetch", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(fullFetchResponse());
    const { result, rerender } = renderHook(({ query }) => useMedicationCatalog(query, { debounceMs: 0 }), {
      initialProps: { query: "cloz" },
    });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // "lithium" ranks for the next query but was never in the cached base
    // catalogue (e.g. published mid-session) — the route still projects it
    // down to the compact `fields=index` shape.
    const lithiumIndex: MedicationRecord = { ...fullLithium, stats: [], sections: [], quick: [] };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        records: [indexClozapine],
        matches: [{ ...lithiumMatchPayload(), medication: lithiumIndex }],
        total: 2,
        governance: {},
      }),
    );
    rerender({ query: "lithium" });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=lithium&fields=index",
      expect.objectContaining({ headers: authSession.authorizationHeader }),
    );
    // THE INVARIANT this hook exists to uphold: a match whose slug had no
    // counterpart in the cache is marked unhydrated rather than silently
    // treated as complete. The workspace reads exactly this flag to keep the
    // safety engines off an empty `sections` array (F1).
    expect(result.current.data?.matches?.[0]?.hydrated).toBe(false);
    expect(result.current.data?.matches?.[0]?.medication).toEqual(lithiumIndex);

    // Self-healing (F1, part 2): the miss must trigger a follow-up request,
    // transient rather than sticky, and that request must ask for the full
    // catalogue again (no cache left to reuse `fields=index` against).
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        records: [fullClozapine, fullLithium],
        matches: [lithiumMatchPayload()],
        total: 2,
        governance: {},
      }),
    );
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/medications?q=lithium",
      expect.objectContaining({ headers: authSession.authorizationHeader }),
    );
    expect(result.current.data?.matches?.[0]?.hydrated).toBe(true);
    expect(result.current.data?.matches?.[0]?.medication).toEqual(fullLithium);
  });
});

describe("useMedicationCatalog — F3 cache time-to-live", () => {
  it("retires the cached base catalogue past its TTL and re-fetches in full, rather than serving a stale total/governance indefinitely", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(fullFetchResponse()); // total: 1
    const { result, rerender } = renderHook(({ query }) => useMedicationCatalog(query, { debounceMs: 0 }), {
      initialProps: { query: "cloz" },
    });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(result.current.data?.total).toBe(1);

    // The reviewer's F3 scenario: the server's answer changes (a second
    // medication published, a governance status advances) while the tab sits
    // idle past the cache's fresh window.
    await act(async () => vi.advanceTimersByTimeAsync(siteContentRecordCacheTtlMs + 1));

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        records: [fullClozapine, fullLithium],
        total: 2,
        governance: {
          clozapine: { sourceStatus: "current", validationStatus: "approved" },
          lithium: { sourceStatus: "current", validationStatus: "approved" },
        },
      }),
    );
    rerender({ query: "clozapine" });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    // A genuinely fresh full-fidelity request, not `...&fields=index`: the
    // stale cache was discarded outright rather than reused with a caveat.
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/medications?q=clozapine",
      expect.objectContaining({ headers: authSession.authorizationHeader }),
    );
    expect(result.current.data?.total).toBe(2);
    expect(result.current.data?.records).toEqual([fullClozapine, fullLithium]);
  });

  it("keeps serving the cached catalogue with no network request inside the TTL window", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(fullFetchResponse());
    const { result, rerender } = renderHook(({ query }) => useMedicationCatalog(query, { debounceMs: 0 }), {
      initialProps: { query: "cloz" },
    });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(siteContentRecordCacheTtlMs - 1_000));
    rerender({ query: "" });
    await act(async () => vi.runOnlyPendingTimersAsync());
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1); // still fresh — no request for the empty-query view
    expect(result.current.data?.records).toEqual([fullClozapine]);
  });
});
