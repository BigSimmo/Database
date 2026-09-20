import { describe, expect, it } from "vitest";

import { evaluateRequirement, evaluateYear, totalAllocatedHours } from "@/lib/cme/evaluate";
import type { CmeEntry, CmeRequirement } from "@/lib/cme/types";

function entry(date: string, allocations: CmeEntry["allocations"], buckets: readonly string[] = []): CmeEntry {
  return {
    id: `e-${date}-${allocations.map((a) => a.category).join("-")}`,
    date,
    title: "An activity",
    allocations,
    reflection: "",
    costCents: null,
    transcribed: false,
    routineId: null,
    documentId: null,
    buckets,
  };
}

const combined: CmeRequirement = {
  id: "combined",
  label: "Reviewing + measuring, combined",
  source: "national",
  completedOn: null,
  spec: {
    shape: "hours-across-categories",
    categories: ["reviewing", "measuring"],
    minimumHours: 25,
    minimumEachHours: 5,
  },
};

describe("a combined minimum with a floor in each category", () => {
  it("is NOT met when the total is reached but one category is under its floor", () => {
    // 25 hours combined, but only 2 in measuring. This is the exact shape a
    // tracker that models only totals reports as compliant, and it is the
    // failure this model exists to prevent.
    const entries = [
      entry("2026-03-01", [{ category: "reviewing", hours: 23 }]),
      entry("2026-04-01", [{ category: "measuring", hours: 2 }]),
    ];
    const status = evaluateRequirement(combined, entries);
    expect(status.met).toBe(false);
    expect(status.summary).toBe("3 hours short in measuring outcomes");
  });

  it("is met when both the total and both floors are reached", () => {
    const entries = [
      entry("2026-03-01", [{ category: "reviewing", hours: 19 }]),
      entry("2026-04-01", [{ category: "measuring", hours: 6 }]),
    ];
    expect(evaluateRequirement(combined, entries).met).toBe(true);
  });

  it("reports the larger of the two gaps when both the total and a floor are short", () => {
    const entries = [
      entry("2026-03-01", [{ category: "reviewing", hours: 8 }]),
      entry("2026-04-01", [{ category: "measuring", hours: 2 }]),
    ];
    const status = evaluateRequirement(combined, entries);
    expect(status.met).toBe(false);
    expect(status.progress).toEqual({ value: 10, target: 25 });
    expect(status.summary).toBe("15 hours short");
  });
});

describe("the other three shapes", () => {
  it("counts hours in one category", () => {
    const requirement: CmeRequirement = {
      id: "educational",
      label: "Educational activities",
      source: "national",
      completedOn: null,
      spec: { shape: "hours-in-category", category: "educational", minimumHours: 12.5 },
    };
    const entries = [entry("2026-02-01", [{ category: "educational", hours: 15 }])];
    const status = evaluateRequirement(requirement, entries);
    expect(status.met).toBe(true);
    expect(status.summary).toBe("Met");
  });

  it("counts activities per bucket, not hours", () => {
    const requirement: CmeRequirement = {
      id: "domains",
      label: "Practice domains",
      source: "national",
      completedOn: null,
      spec: {
        shape: "activity-count",
        buckets: ["Culturally safe practice", "Health inequities", "Professionalism", "Ethical practice"],
        minimumPerBucket: 1,
      },
    };
    const entries = [
      entry("2026-02-01", [{ category: "educational", hours: 1 }], ["Culturally safe practice"]),
      entry("2026-03-01", [{ category: "educational", hours: 1 }], ["Health inequities"]),
      entry("2026-04-01", [{ category: "educational", hours: 1 }], ["Professionalism"]),
    ];
    const status = evaluateRequirement(requirement, entries);
    expect(status.met).toBe(false);
    expect(status.progress).toEqual({ value: 3, target: 4 });
    expect(status.summary).toBe("Ethical practice has nothing against it yet");
  });

  it("names the count, not the buckets, once more than one is empty", () => {
    const requirement: CmeRequirement = {
      id: "domains",
      label: "Practice domains",
      source: "national",
      completedOn: null,
      spec: {
        shape: "activity-count",
        buckets: ["Culturally safe practice", "Health inequities", "Professionalism", "Ethical practice"],
        minimumPerBucket: 1,
      },
    };
    const entries = [
      entry("2026-02-01", [{ category: "educational", hours: 1 }], ["Culturally safe practice"]),
      entry("2026-03-01", [{ category: "educational", hours: 1 }], ["Health inequities"]),
    ];
    const status = evaluateRequirement(requirement, entries);
    expect(status.met).toBe(false);
    expect(status.progress).toEqual({ value: 2, target: 4 });
    // Naming four missing domains in one line reads as a scolding list; the
    // count says the same thing and the screen shows which ones.
    expect(status.summary).toBe("2 of 4 have nothing against them yet");
  });

  it("treats a task as done only when the owner marked it done", () => {
    const base: CmeRequirement = {
      id: "plan",
      label: "Development plan",
      source: "national",
      completedOn: null,
      spec: { shape: "task" },
    };
    expect(evaluateRequirement(base, []).met).toBe(false);
    expect(evaluateRequirement({ ...base, completedOn: "2026-01-12" }, []).met).toBe(true);
  });
});

describe("the target is the owner's number, always", () => {
  it("reports back exactly the minimum the requirement declares, and nothing derived from it", () => {
    const requirement: CmeRequirement = {
      id: "educational",
      label: "Educational activities",
      source: "national",
      completedOn: null,
      spec: { shape: "hours-in-category", category: "educational", minimumHours: 12.5 },
    };
    // There is no third argument. No fraction, no full-time equivalent, no
    // profile — the evaluator cannot reduce a target because there is nothing
    // to reduce it with, and `evaluateRequirement.length` proves it.
    expect(evaluateRequirement.length).toBe(2);
    // `.length` alone is a weaker guard than it looks: a parameter with a
    // default value, and a rest parameter, are both excluded from it. A future
    // `scaleFactor = 1` would slip past while doing exactly the thing this test
    // exists to forbid. Pin the parameter list itself.
    const source = evaluateRequirement.toString();
    const parameterList = source.slice(source.indexOf("(") + 1, source.indexOf(")"));
    expect(parameterList.split(",").map((name) => name.trim())).toEqual(["requirement", "entries"]);
    expect(evaluateRequirement(requirement, []).progress).toEqual({ value: 0, target: 12.5 });
  });
});

describe("an entry allocates across requirements", () => {
  it("counts one activity's hours in every category it was allocated to", () => {
    const entries = [
      entry("2026-09-11", [
        { category: "reviewing", hours: 1 },
        { category: "measuring", hours: 0.5 },
      ]),
    ];
    expect(totalAllocatedHours(entries)).toBe(1.5);
    expect(evaluateRequirement(combined, entries).progress).toEqual({ value: 1.5, target: 25 });
  });
});

describe("the whole year", () => {
  it("returns a status per requirement and the year's total hours", () => {
    const result = evaluateYear({
      set: {
        year: 2026,
        confirmedOn: "2026-09-19",
        confirmedSource: "Medical Board CPD registration standard",
        totalHours: 50,
        requirements: [combined],
      },
      entries: [
        entry("2026-03-01", [{ category: "reviewing", hours: 8 }]),
        entry("2026-04-01", [{ category: "measuring", hours: 2 }]),
      ],
    });
    expect(result.totalHours).toBe(10);
    expect(result.statuses).toHaveLength(1);
    expect(result.unmet.map((status) => status.requirementId)).toEqual(["combined"]);
  });
});
