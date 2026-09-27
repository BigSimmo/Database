import { describe, expect, it } from "vitest";

import { parseRosterMakerChange } from "@/lib/roster/maker/parse";

const ALEX = "11111111-1111-4111-8111-111111111111";
const SAM = "22222222-2222-4222-8222-222222222222";
const DUTY = "33333333-3333-4333-8333-333333333333";

const base = {
  people: [{ userId: ALEX, name: "Alex Example", grade: "registrar" }],
  codes: [
    { code: "D", kind: "day", starts: "08:00", ends: "16:00" },
    { code: "N", kind: "night", starts: "21:00", ends: "07:00" },
    { code: "OFF", kind: "off", starts: null, ends: null },
  ],
  assignments: [],
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
};

describe("deterministic manager change parser", () => {
  it("proposes one Perth overnight add without changing the input", () => {
    const result = parseRosterMakerChange("Set Alex Example on 2026-10-20 to N", base);
    expect(result).toMatchObject({
      status: "ready",
      date: "2026-10-20",
      before: null,
      after: { shiftCode: "N" },
      operation: {
        op: "add",
        row: {
          userId: ALEX,
          rosterName: "Alex Example",
          siteId: null,
          startsAt: "2026-10-20T13:00:00.000Z",
          endsAt: "2026-10-20T23:00:00.000Z",
          shiftCode: "N",
          kind: "night",
          grade: "registrar",
        },
      },
    });
    expect(base.assignments).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("Set Alex Example");
  });

  it.each(["Australia/Perth", "UTC", "America/New_York"])("uses Perth wall time with device zone %s", (zone) => {
    const previousZone = process.env.TZ;
    try {
      process.env.TZ = zone;
      const result = parseRosterMakerChange("Set Alex Example on 2026-10-20 to N", base);
      expect(result).toMatchObject({
        status: "ready",
        operation: {
          row: {
            startsAt: "2026-10-20T13:00:00.000Z",
            endsAt: "2026-10-20T23:00:00.000Z",
          },
        },
      });
    } finally {
      if (previousZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousZone;
    }
  });

  it("proposes a single existing duty update and an explicit OFF removal", () => {
    const assignments = [
      {
        id: DUTY,
        userId: ALEX,
        startsAt: "2026-10-20T00:00:00.000Z",
        endsAt: "2026-10-20T08:00:00.000Z",
        shiftCode: "D",
        kind: "day",
        siteId: "44444444-4444-4444-8444-444444444444",
      },
    ];
    const context = { ...base, assignments };
    expect(parseRosterMakerChange("Set Alex Example on 2026-10-20 to N", context)).toMatchObject({
      status: "ready",
      before: { shiftCode: "D" },
      after: { shiftCode: "N" },
      operation: {
        op: "update",
        id: DUTY,
        row: { shiftCode: "N", siteId: "44444444-4444-4444-8444-444444444444" },
      },
    });
    expect(parseRosterMakerChange("Set Alex Example on 2026-10-20 to OFF", context)).toMatchObject({
      status: "ready",
      before: { shiftCode: "D" },
      after: null,
      operation: { op: "remove", id: DUTY },
    });
    expect(assignments).toHaveLength(1);
  });

  it.each([
    "Set Alex on 2026-10-20 to D",
    "Set Alex Example on tomorrow to D",
    "Set Alex Example on 2026-02-30 to D",
    "Set Alex Example on 2026-11-01 to D",
    "Set Alex Example on 2026-10-20 to Unknown",
    "Set Alex Example on 2026-10-20 to OFF",
    "Do not set Alex Example on 2026-10-20 to D",
    "Set Alex Example on 2026-10-20 to D except Friday",
    "Set Alex Example on 2026-10-20 to D; set Sam Example on 2026-10-21 to N",
  ])("refuses unsupported or unsafe text: %s", (text) => {
    expect(parseRosterMakerChange(text, base).status).toBe("refused");
  });

  it("refuses duplicate exact names or shift codes", () => {
    expect(
      parseRosterMakerChange("Set Alex Example on 2026-10-20 to D", {
        ...base,
        people: [...base.people, { userId: SAM, name: "Alex Example", grade: "resident" }],
      }).status,
    ).toBe("refused");
    expect(
      parseRosterMakerChange("Set Alex Example on 2026-10-20 to D", {
        ...base,
        codes: [...base.codes, { code: "D", kind: "day", starts: "09:00", ends: "17:00" }],
      }).status,
    ).toBe("refused");
  });

  it("refuses multiple duties on the person's Perth date and unchanged edits", () => {
    const duty = {
      id: DUTY,
      userId: ALEX,
      startsAt: "2026-10-20T00:00:00.000Z",
      endsAt: "2026-10-20T08:00:00.000Z",
      shiftCode: "D",
      kind: "day",
    };
    expect(
      parseRosterMakerChange("Set Alex Example on 2026-10-20 to N", {
        ...base,
        assignments: [duty, { ...duty, id: SAM }],
      }).status,
    ).toBe("refused");
    expect(
      parseRosterMakerChange("Set Alex Example on 2026-10-20 to D", {
        ...base,
        assignments: [duty],
      }).status,
    ).toBe("refused");
  });
});
