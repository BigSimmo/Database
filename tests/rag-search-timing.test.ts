import { afterEach, describe, expect, it, vi } from "vitest";

import { createSearchTiming, measureSearchPhase, startRerankClock } from "@/lib/rag/rag-search-timing";

describe("startRerankClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes hydration phases recorded inside the window", async () => {
    vi.useFakeTimers();
    const timing = createSearchTiming();
    const elapsed = startRerankClock(timing);

    await measureSearchPhase(timing, "metadata_hydration", async () => {
      vi.advanceTimersByTime(300);
    });
    vi.advanceTimersByTime(40);
    await measureSearchPhase(timing, "visual_hydration", async () => {
      vi.advanceTimersByTime(200);
    });

    expect(elapsed()).toBe(40);
    expect(timing.phases).toEqual({ metadata_hydration: 300, visual_hydration: 200 });
  });

  it("ignores hydration time recorded before the clock started, and non-hydration phases", async () => {
    vi.useFakeTimers();
    const timing = createSearchTiming();
    await measureSearchPhase(timing, "memory_hydration", async () => {
      vi.advanceTimersByTime(500);
    });

    const elapsed = startRerankClock(timing);
    await measureSearchPhase(timing, "shared_cache_lookup", async () => {
      vi.advanceTimersByTime(70);
    });
    vi.advanceTimersByTime(30);

    expect(elapsed()).toBe(100);
  });

  it("counts memory rescoring after memory artifact hydration completes", async () => {
    vi.useFakeTimers();
    const timing = createSearchTiming();
    const elapsed = startRerankClock(timing);

    await measureSearchPhase(timing, "memory_hydration", async () => {
      vi.advanceTimersByTime(200);
    });
    vi.advanceTimersByTime(35); // Apply the loaded cards to candidates after the hydration phase.

    expect(elapsed()).toBe(35);
    expect(timing.phases.memory_hydration).toBe(200);
  });

  it("never reports a negative duration when concurrent hydration overlaps the window", () => {
    vi.useFakeTimers();
    const timing = createSearchTiming();
    const elapsed = startRerankClock(timing);
    vi.advanceTimersByTime(10);
    timing.phases.metadata_and_memory_hydration = 250;

    expect(elapsed()).toBe(0);
  });
});
