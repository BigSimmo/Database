/** @vitest-environment jsdom */

// #W0T66R: `/medications/<unknown-slug>` rendered a bare "Request failed (404)".
// The detail hook now reports a named not-found, but only when all three hold:
// the API said `medication_not_found` (not merely any 404), sign-in has resolved
// (an owner-only record 404s for the anonymous pre-auth fetch), and the result
// belongs to the current auth header. 401, 429 and 5xx stay errors.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMedicationDetail } from "@/components/clinical-dashboard/use-medication-catalog";

type Status = "unconfigured" | "loading" | "signed_out" | "authenticated" | "expired" | "error";

const authSession = vi.hoisted(() => ({
  authorizationHeader: {} as Record<string, string>,
  session: null as { user: { id: string } } | null,
  status: "signed_out" as Status,
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => authSession,
}));

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function notFound(slug: string) {
  return jsonResponse({ error: `No medication found for "${slug}".`, code: "medication_not_found" }, 404);
}

async function flushMicrotasks() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  });
}

const record = {
  slug: "owner-med",
  name: "Owner Med",
  class: "Test",
  subclass: "",
  category: "",
  accent: "teal",
  tag: "",
  schedule: "",
  stats: [],
  sections: [],
  quick: [],
};

beforeEach(() => {
  authSession.authorizationHeader = {};
  authSession.session = null;
  authSession.status = "signed_out";
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useMedicationDetail not-found (#W0T66R)", () => {
  it("reports a named not-found for medication_not_found once sign-in has resolved", async () => {
    fetchMock.mockResolvedValueOnce(notFound("zzz"));

    const { result } = renderHook(() => useMedicationDetail("zzz"));
    await flushMicrotasks();

    expect(result.current).toMatchObject({ data: null, loading: false, notFound: true });
  });

  it("does not report not-found for a 404 that lacks the medication_not_found code", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));

    const { result } = renderHook(() => useMedicationDetail("zzz"));
    await flushMicrotasks();

    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toMatch(/404/);
  });

  it.each([401, 429, 500, 503])("keeps a %i as an error, never a not-found", async (status) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope", code: "medication_not_found" }, status));

    const { result } = renderHook(() => useMedicationDetail("zzz"));
    await flushMicrotasks();

    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toMatch(new RegExp(String(status)));
  });

  it("does not claim not-found while sign-in is still resolving, and shows loading rather than an error", async () => {
    authSession.status = "loading";
    fetchMock.mockResolvedValueOnce(notFound("owner-med"));

    const { result } = renderHook(() => useMedicationDetail("owner-med"));
    await flushMicrotasks();

    expect(result.current).toMatchObject({ notFound: false, loading: true, error: null });
  });

  it("keeps the record through a token refresh for the same user, and refetches with the new token", async () => {
    authSession.status = "authenticated";
    authSession.session = { user: { id: "owner" } };
    authSession.authorizationHeader = { Authorization: "Bearer first-token" };
    fetchMock.mockResolvedValueOnce(jsonResponse({ record }));
    const { result, rerender } = renderHook(() => useMedicationDetail("owner-med"));
    await flushMicrotasks();
    expect(result.current.data?.record.name).toBe("Owner Med");

    let resolveRefresh!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveRefresh = resolve)));
    authSession.authorizationHeader = { Authorization: "Bearer refreshed-token" };
    rerender();

    // Same identity, new credential: the owner-only record must not blank to a skeleton.
    expect(result.current.data?.record.name).toBe("Owner Med");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/medications/owner-med",
      expect.objectContaining({ headers: { Authorization: "Bearer refreshed-token" } }),
    );
    await act(async () => resolveRefresh(jsonResponse({ record: { ...record, name: "Owner Med v2" } })));
    await flushMicrotasks();
    expect(result.current.data?.record.name).toBe("Owner Med v2");
  });

  it("resets when the auth header changes, so the anonymous 404 never stands for the owner's record", async () => {
    authSession.status = "loading";
    fetchMock.mockResolvedValueOnce(notFound("owner-med"));
    const { result, rerender } = renderHook(() => useMedicationDetail("owner-med"));
    await flushMicrotasks();

    let resolveOwner!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveOwner = resolve)));
    authSession.status = "authenticated";
    authSession.session = { user: { id: "owner" } };
    authSession.authorizationHeader = { Authorization: "Bearer owner-token" };
    rerender();

    // Resolved auth plus a stale anonymous 404 must not flash a not-found.
    expect(result.current).toMatchObject({ data: null, loading: true, error: null, notFound: false });

    await act(async () => resolveOwner(jsonResponse({ record })));
    await flushMicrotasks();
    expect(result.current.data?.record.name).toBe("Owner Med");
    expect(result.current.notFound).toBe(false);
  });

  it("stays silent when a request is aborted by a slug change", async () => {
    fetchMock.mockImplementation((_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const { result, rerender } = renderHook(({ slug }) => useMedicationDetail(slug), {
      initialProps: { slug: "first" },
    });
    rerender({ slug: "second" });
    await flushMicrotasks();

    expect(result.current).toMatchObject({ loading: true, error: null, notFound: false });
  });
});
