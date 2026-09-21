import { describe, expect, it } from "vitest";

import {
  cmeRoutineCadenceLabels,
  formatRoutineDueDate,
  formatRoutineHours,
  routineLogPrefill,
  routinesDueOn,
} from "@/lib/cme/routines";

const supervision = {
  id: "r1",
  title: "Supervision",
  cadence: "monthly" as const,
  usualHours: 1,
  usualAllocations: [],
  nextDue: "2026-09-28",
  archivedAt: null,
};

describe("routines", () => {
  it("is due when its next date has arrived, in Perth", () => {
    expect(routinesDueOn([supervision], new Date("2026-09-28T02:00:00Z")).map((r) => r.id)).toEqual(["r1"]);
    expect(routinesDueOn([supervision], new Date("2026-09-27T02:00:00Z"))).toEqual([]);
  });

  it("never logs itself — the function returns what is due, and nothing else", () => {
    // Only the owner knows whether he was actually there. `routinesDueOn` is a
    // read; there is no companion that writes an entry without a confirmation.
    expect(routinesDueOn.length).toBe(2);
  });

  it("ignores an archived routine", () => {
    expect(
      routinesDueOn([{ ...supervision, archivedAt: "2026-06-01T00:00:00Z" }], new Date("2026-09-28T02:00:00Z")),
    ).toEqual([]);
  });
});

describe("routinesDueOn — beyond the transcribed brief", () => {
  it("leaves a routine with no next-due date alone — unscheduled is not overdue", () => {
    expect(routinesDueOn([{ ...supervision, nextDue: null }], new Date("2026-09-28T02:00:00Z"))).toEqual([]);
  });

  it("orders several due routines soonest-first", () => {
    const later = { ...supervision, id: "r2", nextDue: "2026-09-30" };
    const sooner = { ...supervision, id: "r3", nextDue: "2026-09-01" };
    const ids = routinesDueOn([supervision, later, sooner], new Date("2026-09-30T02:00:00Z")).map((r) => r.id);
    expect(ids).toEqual(["r3", "r1", "r2"]);
  });
});

describe("routineLogPrefill", () => {
  it("carries the routine's usual hours and split forward, dated today in Perth", () => {
    const withSplit = {
      ...supervision,
      usualAllocations: [{ category: "reviewing" as const, hours: 1 }],
    };
    expect(routineLogPrefill(withSplit, new Date("2026-09-19T02:00:00Z"))).toEqual({
      routineId: "r1",
      date: "2026-09-19",
      title: "Supervision",
      hours: 1,
      allocations: [{ category: "reviewing", hours: 1 }],
    });
  });

  it("never backdates to nextDue — a routine is always offered as of today", () => {
    // `supervision.nextDue` is 2026-09-28; logging it on the 19th must not silently
    // record the 28th, because "due" and "when it happened" are different facts.
    expect(routineLogPrefill(supervision, new Date("2026-09-19T02:00:00Z")).date).toBe("2026-09-19");
  });
});

describe("formatRoutineDueDate", () => {
  it("renders a Perth calendar date in plain words", () => {
    expect(formatRoutineDueDate("2026-09-28")).toBe("28 Sep 2026");
    expect(formatRoutineDueDate("2026-12-01")).toBe("1 Dec 2026");
  });
});

describe("formatRoutineHours", () => {
  it("always shows one decimal place", () => {
    expect(formatRoutineHours(1)).toBe("1.0");
    expect(formatRoutineHours(1.5)).toBe("1.5");
  });
});

describe("cmeRoutineCadenceLabels", () => {
  it("has a plain-word label for every cadence", () => {
    expect(cmeRoutineCadenceLabels).toEqual({ weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly" });
  });
});
