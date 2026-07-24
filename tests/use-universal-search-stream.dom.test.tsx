import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUniversalSearch, clearUniversalSearchCacheForTests } from "@/components/clinical-dashboard/use-universal-search";
import type { UniversalSearchGroup, UniversalSearchResponse } from "@/lib/universal-search";
import type { UniversalSearchStreamEvent } from "@/lib/universal-search-stream";

const authSession = vi.hoisted(() => ({
  authorizationHeader: { Authorization: "Bearer universal-search-test" },
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => authSession,
}));

const encoder = new TextEncoder();

function controlledNdjsonResponse() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const cancelled = vi.fn();
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
      cancel(reason) {
        cancelled(reason);
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } },
  );

  return {
    response,
    cancelled,
    write(event: UniversalSearchStreamEvent) {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
    close() {
      controller.close();
    },
  };
}

function searchGroup(kind: "medications" | "tools", title: string): UniversalSearchGroup {
  return {
    kind,
    total: 1,
    latencyMs: 4,
    items: [
      {
        id: `${kind}-${title.toLowerCase().replaceAll(" ", "-")}`,
        kind,
        title,
        href: `/${kind}/${title.toLowerCase().replaceAll(" ", "-")}`,
        score: 10,
      },
    ],
  };
}

async function startDebouncedRequest() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

async function flushStream() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.useFakeTimers();
  clearUniversalSearchCacheForTests();
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearUniversalSearchCacheForTests();
});

describe("useUniversalSearch NDJSON integration", () => {
  it("renders each ready group before committing the canonical final response", async () => {
    const query = "progressive parity query";
    const stream = controlledNdjsonResponse();
    const medicationGroup = searchGroup("medications", "Clozapine");
    const toolsGroup = searchGroup("tools", "Dose calculator");
    const final: UniversalSearchResponse = {
      query,
      groups: [toolsGroup, medicationGroup],
      tookMs: 12,
      domainOrder: ["tools", "medications"],
      contextMode: "answer",
      preferredDomains: ["tools"],
    };
    fetchMock.mockResolvedValue(stream.response);

    const { result } = renderHook(() =>
      useUniversalSearch({ query, enabled: true, contextMode: "answer", excludeDomains: ["documents"] }),
    );
    await startDebouncedRequest();

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(requestUrl.searchParams.get("stream")).toBe("ndjson");

    stream.write({ type: "group", query, group: medicationGroup });
    await flushStream();
    expect(result.current).toMatchObject({ groups: [medicationGroup], loading: true, query });

    stream.write({ type: "group", query, group: toolsGroup });
    await flushStream();
    expect(result.current.groups).toEqual([medicationGroup, toolsGroup]);
    expect(result.current.loading).toBe(true);

    stream.write({ type: "complete", response: final });
    stream.close();
    await flushStream();
    expect(result.current).toMatchObject({
      groups: final.groups,
      loading: false,
      query,
      domainOrder: final.domainOrder,
      contextMode: final.contextMode,
      preferredDomains: final.preferredDomains,
    });
  });

  it("aborts superseded streams, ignores their partial state, and caches only completed responses", async () => {
    const firstQuery = "uncached partial query";
    const secondQuery = "completed cached query";
    const firstStream = controlledNdjsonResponse();
    const secondStream = controlledNdjsonResponse();
    const thirdStream = controlledNdjsonResponse();
    const firstGroup = searchGroup("medications", "First partial");
    const secondGroup = searchGroup("tools", "Second complete");
    const streams = [firstStream, secondStream, thirdStream];
    const requestSignals: AbortSignal[] = [];
    fetchMock.mockImplementation((_input, init) => {
      requestSignals.push(init?.signal as AbortSignal);
      return Promise.resolve(streams[requestSignals.length - 1].response);
    });

    const { result, rerender } = renderHook(
      ({ query }) => useUniversalSearch({ query, enabled: true, contextMode: "answer" }),
      { initialProps: { query: firstQuery } },
    );
    await startDebouncedRequest();
    firstStream.write({ type: "group", query: firstQuery, group: firstGroup });
    await flushStream();
    expect(result.current).toMatchObject({ groups: [firstGroup], loading: true });

    rerender({ query: secondQuery });
    await flushStream();
    expect(requestSignals[0].aborted).toBe(true);
    expect(firstStream.cancelled).toHaveBeenCalledOnce();
    expect(result.current.groups).toEqual([]);

    await startDebouncedRequest();
    const completedResponse: UniversalSearchResponse = {
      query: secondQuery,
      groups: [secondGroup],
      tookMs: 8,
      contextMode: "answer",
    };
    secondStream.write({ type: "complete", response: completedResponse });
    secondStream.close();
    await flushStream();
    expect(result.current).toMatchObject({ groups: [secondGroup], loading: false, query: secondQuery });

    // The aborted first query had only a partial group, so revisiting it must fetch again.
    rerender({ query: firstQuery });
    await startDebouncedRequest();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The completed second query is cached; returning to it aborts the third request and needs no fourth fetch.
    rerender({ query: secondQuery });
    await flushStream();
    await startDebouncedRequest();
    expect(requestSignals[2].aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current).toMatchObject({ groups: [secondGroup], loading: false, query: secondQuery });
  });
});
