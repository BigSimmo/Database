import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDeferredRegistrySearch } from "@/components/clinical-dashboard/use-deferred-registry-search";

vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecords: () => ({
    status: "ready",
    records: [
      {
        id: "svc-1",
        slug: "crisis-line",
        title: "Crisis Line",
        summary: "24/7 crisis support",
        status: "available",
        locality: "local",
        searchText: "crisis line support",
      },
      {
        id: "svc-2",
        slug: "housing",
        title: "Housing Support",
        summary: "Housing pathway",
        status: "available",
        locality: "local",
        searchText: "housing support",
      },
    ],
  }),
}));

vi.mock("@/lib/service-ranker", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-ranker")>("@/lib/service-ranker");
  return actual;
});

vi.mock("@/lib/form-ranker", async () => {
  const actual = await vi.importActual<typeof import("@/lib/form-ranker")>("@/lib/form-ranker");
  return actual;
});

describe("useDeferredRegistrySearch clear behavior", () => {
  it("drops service matches immediately when the live query is cleared", async () => {
    const { result, rerender } = renderHook(({ query }) => useDeferredRegistrySearch("services", query), {
      initialProps: { query: "crisis" },
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Allow deferred value to settle on the typed query.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.recordSearchMatches.length).toBeGreaterThan(0);

    rerender({ query: "" });
    expect(result.current.recordSearchMatches).toEqual([]);
  });
});
