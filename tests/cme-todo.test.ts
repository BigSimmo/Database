import { describe, expect, it } from "vitest";

import { evaluateYear } from "@/lib/cme/evaluate";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";
import type { CmeRoutine } from "@/lib/cme/routines";
import { buildCmeTodo } from "@/lib/cme/todo";
import type { CmeEntry } from "@/lib/cme/types";

function logged(id: string, changes: Partial<CmeEntry> = {}): CmeEntry {
  return {
    id,
    date: "2026-09-26",
    title: `Demo activity ${id}`,
    allocations: [{ category: "educational", hours: 1 }],
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets: [],
    ...changes,
  };
}

describe("buildCmeTodo", () => {
  it("orders work and excludes an unchecked evidence count", () => {
    const set = createAustralianRanzcpPreset(2026, "2026-01-08");
    const entries = [logged("one"), logged("two", { evidenceCount: 0 }), logged("old", { date: "2025-12-01" })];
    const routines: CmeRoutine[] = [
      {
        id: "routine",
        title: "Demo supervision",
        cadence: "weekly",
        usualHours: 1,
        usualAllocations: [{ category: "reviewing", hours: 1 }],
        nextDue: "2026-09-25",
        archivedAt: null,
      },
    ];
    const result = buildCmeTodo({
      set,
      entries,
      routines,
      statuses: evaluateYear({ set, entries }).statuses,
      now: new Date("2026-09-26T04:00:00Z"),
      draftsToFinish: 2,
      nextStep: { id: "next", label: "Write your plan", href: "/cme/setup" },
      nextRequirementId: "combined",
    });
    expect(result.nextToLog[0].id).toBe("next");
    expect(result.nextToLog.some((row) => row.id === "routine-routine")).toBe(true);
    expect(result.toFinish.map((row) => row.id)).toEqual(["copy", "drafts", "reflection", "evidence"]);
    expect(result.toFinish.map((row) => row.count)).toEqual([2, 2, 2, 1]);
    const closed = buildCmeTodo({
      set: { ...set, closedAt: "2026-12-31T16:00:00Z" },
      entries,
      routines,
      statuses: evaluateYear({ set, entries }).statuses,
      now: new Date("2026-09-26T04:00:00Z"),
      draftsToFinish: 0,
      nextStep: { id: "next", label: "Annual summary", href: "/cme/summary" },
    });
    expect(closed.nextToLog.map((row) => row.id)).toEqual(["next"]);
  });
});
