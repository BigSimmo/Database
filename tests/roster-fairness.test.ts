import { expect, it } from "vitest";
import { fairnessCounts } from "@/lib/roster/team/fairness";
import type { RosterAssignment } from "@/lib/roster/team/model";
it("counts weekends and published holidays by Perth start date, excluding leave and on-call hours", () => {
  const row: RosterAssignment = {
    id: "x",
    userId: "alex",
    name: "Dr Alex Example",
    grade: "registrar",
    siteId: null,
    siteName: null,
    startsAt: "2026-10-03T15:00:00Z",
    endsAt: "2026-10-04T00:00:00Z",
    shiftCode: "N",
    kind: "night",
  };
  const holiday = {
    ...row,
    id: "h",
    startsAt: "2026-09-27T23:00:00Z",
    endsAt: "2026-09-28T07:00:00Z",
    kind: "day" as const,
  };
  const result = fairnessCounts([row, holiday, { ...row, id: "leave", kind: "leave" }], {
    from: "2026-09-28",
    to: "2026-10-05",
  });
  expect(result).toEqual([
    { userId: "alex", name: "Dr Alex Example", nights: 1, weekendShifts: 1, publicHolidayShifts: 1, hours: 17 },
  ]);
});
