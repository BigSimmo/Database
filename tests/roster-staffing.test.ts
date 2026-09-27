import { describe, expect, it } from "vitest";
import { coverSuggestions, staffingForDate, type StaffingNeed, type StaffingShift } from "@/lib/roster/maker/staffing";
import type { RosterPerson } from "@/lib/roster/team/model";

const ALEX = "5e000000-0000-4000-8000-000000000003";
const SITE = "5e000000-0000-4000-8000-000000000005";
const base: StaffingNeed = { weekday: 4, date: null, siteId: SITE, grade: "registrar", kind: "night", needed: 2 };
const shift: StaffingShift = {
  id: "duty",
  userId: ALEX,
  rosterName: null,
  siteId: SITE,
  grade: "registrar",
  kind: "night",
  startsAt: "2026-10-01T13:30:00Z",
  endsAt: "2026-10-01T23:00:00Z",
};
const person: RosterPerson = {
  userId: ALEX,
  displayName: "Alex",
  rosterName: "Alex",
  grade: "registrar",
  role: "member",
  joinedAt: "2026-01-01T00:00:00Z",
  serviceRole: "member",
  rotationEndsOn: null,
};
const vacancy: StaffingShift = { ...shift, id: "vacancy", userId: null, rosterName: null };
const rules = { minBreakHours: 10, maxHours7d: 40, source: "Example team policy", reviewedOn: "2026-09-27" };

describe("staffing requirements", () => {
  it("uses a dated zero override only for the matching site, grade and kind", () => {
    const otherSite = { ...base, siteId: null, needed: 3 };
    const dated = { ...base, weekday: null, date: "2026-10-01", needed: 0 };
    const result = staffingForDate("2026-10-01", [base, otherSite, dated], [shift]);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ need: dated, source: "dated", rostered: 1, gap: 0 }),
        expect.objectContaining({ need: otherSite, source: "recurring", rostered: 0, gap: 3 }),
      ]),
    );
    expect(result.rows).toHaveLength(2);
  });

  it("counts overnight work on its Perth start date and excludes genuine vacancies", () => {
    const result = staffingForDate("2026-10-01", [base], [shift, vacancy]);
    expect(result.rows[0]).toEqual(expect.objectContaining({ rostered: 1, gap: 1 }));
    expect(staffingForDate("2026-10-02", [{ ...base, weekday: 5 }], [shift]).rows[0]?.rostered).toBe(0);
  });

  it("refuses duplicate requirements within one dated or recurring scope", () => {
    expect(staffingForDate("2026-10-01", [base, { ...base, needed: 5 }], []).error).toMatch(/Duplicate/);
  });
});

describe("cover suggestions", () => {
  const input = {
    vacancy,
    requiredGrade: "registrar" as const,
    people: [person],
    published: [] as StaffingShift[],
    draft: [vacancy],
    availability: [],
    leave: [],
    rules,
  };
  it("fails closed when the rule or grade is unknown", () => {
    expect(coverSuggestions({ ...input, rules: { ...rules, minBreakHours: null } }).status).toBe("rules_unknown");
    expect(coverSuggestions({ ...input, requiredGrade: null }).status).toBe("grade_unknown");
  });

  it("uses published availability, leave and roster overlap across an overnight shift", () => {
    expect(coverSuggestions(input).candidates.map((candidate) => candidate.name)).toEqual(["Alex"]);
    expect(
      coverSuggestions({ ...input, availability: [{ userId: ALEX, date: "2026-10-02", kind: "cant" as const }] })
        .candidates,
    ).toEqual([]);
    expect(
      coverSuggestions({
        ...input,
        leave: [{ userId: ALEX, startsOn: "2026-10-02", endsOn: "2026-10-02", status: "approved" }],
      }).candidates,
    ).toEqual([]);
    expect(coverSuggestions({ ...input, published: [shift] }).candidates).toEqual([]);
  });

  it("enforces exact grade, a configured break and rolling seven-day hours", () => {
    expect(coverSuggestions({ ...input, people: [{ ...person, grade: "consultant" }] }).candidates).toEqual([]);
    const yesterday = { ...shift, id: "yesterday", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-01T08:00:00Z" };
    expect(coverSuggestions({ ...input, published: [yesterday] }).candidates).toEqual([]);
    expect(coverSuggestions({ ...input, rules: { ...rules, maxHours7d: 8 } }).candidates).toEqual([]);
  });
});
