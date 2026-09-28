import { describe, expect, it } from "vitest";

import { matchRowsToPeople } from "@/lib/roster/publish/match";
import type { RosterPerson } from "@/lib/roster/team/model";

const ravi: RosterPerson = {
  userId: "5e000000-0000-4000-8000-000000000001",
  displayName: "Ravi Sample",
  rosterName: null,
  role: "member",
  serviceRole: "member",
  grade: "registrar",
  joinedAt: "2026-09-01T00:00:00Z",
  rotationEndsOn: null,
};
const alex: RosterPerson = {
  ...ravi,
  userId: "5e000000-0000-4000-8000-000000000002",
  displayName: "Dr Alex Example",
  rosterName: "A Example",
};

describe("matching printed roster rows", () => {
  it("uses a unique exact roster name before a display name and retains unmatched rows", () => {
    const out = matchRowsToPeople([" a   example ", "Dr Alex Example", "Locum 1"], [ravi, alex]);
    expect(out[0].match).toEqual({ userId: alex.userId, how: "roster_name" });
    expect(out[1].match).toEqual({ userId: alex.userId, how: "display_name" });
    expect(out[2]).toEqual({ rowName: "Locum 1", match: null });
  });

  it("only suggests an initial and surname, never auto-matches them", () => {
    expect(matchRowsToPeople(["R Sample"], [ravi])[0].match).toEqual({ suggestion: ravi.userId });
  });

  it("does not choose one of two people with the same printed name", () => {
    expect(matchRowsToPeople(["Ravi Sample"], [ravi, { ...alex, displayName: "Ravi Sample" }])[0].match).toBeNull();
  });
});
