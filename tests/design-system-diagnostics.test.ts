import { describe, expect, it, vi } from "vitest";

import { createBoundedDiagnosticRecorder } from "@/components/ui/design-system-diagnostics";

describe("bounded design-system diagnostics", () => {
  it("deduplicates recent keys and evicts the oldest key at the cap", () => {
    const emit = vi.fn();
    const record = createBoundedDiagnosticRecorder({ capacity: 2, emit });

    record("a", "first");
    record("a", "duplicate");
    record("b", "second");
    record("c", "third");
    record("a", "first again after eviction");

    expect(emit.mock.calls.map(([message]) => message)).toEqual([
      "first",
      "second",
      "third",
      "first again after eviction",
    ]);
  });
});
