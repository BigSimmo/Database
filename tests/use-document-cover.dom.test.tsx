import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: {
    authorizationHeader: { Authorization: "Bearer token-a" } as Record<string, string>,
    session: { user: { id: "user-a" } } as { user: { id: string } } | null,
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => auth.value,
}));

import {
  resetDocumentCoverCacheForTests,
  useDocumentCoverImageId,
} from "@/components/clinical-dashboard/use-document-cover";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";

function coverResponse(coverImageId: string | null) {
  return { ok: true, status: 200, json: async () => ({ coverImageId }) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, reject, resolve };
}

function setAuth(userId: string | null, token: string) {
  auth.value = {
    authorizationHeader: { Authorization: `Bearer ${token}` },
    session: userId ? { user: { id: userId } } : null,
  };
}

beforeEach(() => {
  resetDocumentCoverCacheForTests();
  setAuth("user-a", "token-a");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetDocumentCoverCacheForTests();
});

describe("useDocumentCoverImageId", () => {
  it("forwards the active authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(coverResponse("cover-a"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDocumentCoverImageId(DOCUMENT_ID));

    await waitFor(() => expect(result.current.coverImageId).toBe("cover-a"));
    expect(fetchMock).toHaveBeenCalledWith(`/api/documents/${DOCUMENT_ID}/cover`, {
      headers: { Authorization: "Bearer token-a" },
    });
  });

  it("binds in-flight work and resolved values to the authenticated identity", async () => {
    const first = deferred<ReturnType<typeof coverResponse>>();
    const second = deferred<ReturnType<typeof coverResponse>>();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(() => useDocumentCoverImageId(DOCUMENT_ID));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    setAuth("user-b", "token-b");
    rerender();
    expect(result.current.coverImageId).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => first.resolve(coverResponse("cover-a")));
    expect(result.current.coverImageId).toBeNull();

    await act(async () => second.resolve(coverResponse("cover-b")));
    await waitFor(() => expect(result.current.coverImageId).toBe("cover-b"));

    setAuth("user-a", "token-a-refreshed");
    rerender();
    expect(result.current.coverImageId).toBe("cover-a");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a healthy cover through same-user token refresh without refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(coverResponse("cover-a"));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => useDocumentCoverImageId(DOCUMENT_ID));
    await waitFor(() => expect(result.current.coverImageId).toBe("cover-a"));

    setAuth("user-a", "token-a-refreshed");
    rerender();

    expect(result.current.coverImageId).toBe("cover-a");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches an authoritative null for the current identity and document", async () => {
    const payload = deferred<{ coverImageId: null }>();
    const json = vi.fn().mockReturnValue(payload.promise);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json });
    vi.stubGlobal("fetch", fetchMock);
    const first = renderHook(() => useDocumentCoverImageId(DOCUMENT_ID));
    await waitFor(() => expect(json).toHaveBeenCalledTimes(1));
    await act(async () => payload.resolve({ coverImageId: null }));
    first.unmount();

    const second = renderHook(() => useDocumentCoverImageId(DOCUMENT_ID));

    expect(second.result.current.coverImageId).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a transient failure and retries on the next open", async () => {
    const failedRequest = deferred<ReturnType<typeof coverResponse>>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(failedRequest.promise)
      .mockResolvedValueOnce(coverResponse("cover-after-retry"));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      ({ documentId }: { documentId: string | null }) => useDocumentCoverImageId(documentId),
      { initialProps: { documentId: DOCUMENT_ID as string | null } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => failedRequest.reject(new Error("offline")));

    rerender({ documentId: null });
    rerender({ documentId: DOCUMENT_ID });

    await waitFor(() => expect(result.current.coverImageId).toBe("cover-after-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a malformed successful payload and retries on the next open", async () => {
    const malformedPayload = deferred<{ unexpected: true }>();
    const malformedJson = vi.fn().mockReturnValue(malformedPayload.promise);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: malformedJson })
      .mockResolvedValueOnce(coverResponse("cover-after-malformed"));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      ({ documentId }: { documentId: string | null }) => useDocumentCoverImageId(documentId),
      { initialProps: { documentId: DOCUMENT_ID as string | null } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(malformedJson).toHaveBeenCalledTimes(1));
    await act(async () => malformedPayload.resolve({ unexpected: true }));

    rerender({ documentId: null });
    rerender({ documentId: DOCUMENT_ID });

    await waitFor(() => expect(result.current.coverImageId).toBe("cover-after-malformed"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores stale image callbacks and callbacks from a previous identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(coverResponse("cover-a"))
      .mockResolvedValueOnce(coverResponse("cover-b"));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => useDocumentCoverImageId(DOCUMENT_ID));
    await waitFor(() => expect(result.current.coverImageId).toBe("cover-a"));
    const markForUserA = result.current.markCoverUnavailable;

    act(() => result.current.markCoverUnavailable("another-cover"));
    expect(result.current.coverImageId).toBe("cover-a");

    setAuth("user-b", "token-b");
    rerender();
    await waitFor(() => expect(result.current.coverImageId).toBe("cover-b"));
    act(() => markForUserA("cover-a"));
    expect(result.current.coverImageId).toBe("cover-b");

    setAuth("user-a", "token-a-refreshed");
    rerender();
    expect(result.current.coverImageId).toBe("cover-a");

    act(() => result.current.markCoverUnavailable("cover-a"));
    expect(result.current.coverImageId).toBeNull();
  });
});
