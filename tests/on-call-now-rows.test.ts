import { describe, expect, it } from "vitest";

import { publishedHandbookItems, type HandbookItem } from "@/lib/on-call/handbook-items";
import {
  handbookTeams,
  onCallDialKey,
  onCallHospitalPeriod,
  onCallHoursTrack,
  onCallLadderStepMarkId,
  selectNeedsYou,
  switchboardItem,
  yourTeamRows,
  type OnCallLadder,
} from "@/lib/on-call/now-rows";
import type { OnCallCallNowStep } from "@/lib/on-call/call-now";
import type { ServiceEntry } from "@/lib/on-call/service-model";

const SITE = "30000000-0000-4000-8000-00000000000a";

/** Synthetic contacts only: `9000 00xx`, numbered by position. */
function contacts(titles: readonly string[]): HandbookItem[] {
  return publishedHandbookItems({
    entries: titles.map((title, index) => {
      const content = {
        siteId: SITE,
        section: "contacts",
        kind: "operational",
        title,
        body: "Synthetic example only",
        phone: `9000 00${String(index + 10).padStart(2, "0")}`,
        sources: [],
        orientationPhase: "first_shift",
      } as ServiceEntry["content"];
      return {
        id: `c${index}`,
        revision: 1,
        publishedRevision: 1,
        content,
        publishedContent: content,
        status: "published",
        authorId: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewComment: "",
        updatedAt: "2026-09-20T04:00:00.000Z",
      } as ServiceEntry;
    }),
  });
}

describe("Your team", () => {
  it("shows up to three of my team in hours", () => {
    const items = contacts([
      "Medicine: Registrar",
      "Medicine: Consultant",
      "Medicine: Intern",
      "Medicine: RMO",
      "After-hours manager: Coordinator",
    ]);
    expect(yourTeamRows(items, "Medicine", "in-hours").map((item) => item.parsed.label)).toEqual([
      "Consultant",
      "Intern",
      "Registrar",
    ]);
  });

  it("keeps the last slot for the after-hours manager after hours", () => {
    const items = contacts([
      "Medicine: Registrar",
      "Medicine: Consultant",
      "Medicine: Intern",
      "After-hours manager: Coordinator",
    ]);
    expect(yourTeamRows(items, "Medicine", "after-hours").map((item) => item.title)).toEqual([
      "Medicine: Consultant",
      "Medicine: Intern",
      "After-hours manager: Coordinator",
    ]);
  });

  it("omits the manager slot when none is recorded, with no placeholder", () => {
    const items = contacts(["Medicine: Registrar", "Medicine: Consultant", "Medicine: Intern"]);
    expect(yourTeamRows(items, "Medicine", "after-hours")).toHaveLength(3);
  });

  it("still shows the manager after hours before a team is chosen", () => {
    const items = contacts(["ICU: Registrar", "After-hours manager: Coordinator"]);
    expect(yourTeamRows(items, null, "after-hours").map((item) => item.title)).toEqual([
      "After-hours manager: Coordinator",
    ]);
    expect(yourTeamRows(items, null, "in-hours")).toEqual([]);
  });

  it("never lists the manager twice when it is the reader's own team", () => {
    const items = contacts(["After-hours manager: Coordinator", "After-hours manager: Deputy"]);
    expect(yourTeamRows(items, "After-hours manager", "after-hours").map((item) => item.title)).toEqual([
      "After-hours manager: Deputy",
      "After-hours manager: Coordinator",
    ]);
  });

  it("lists the handbook's teams in the shared order, including ones no list names", () => {
    expect(handbookTeams(contacts(["Orthopaedics: Registrar", "ICU: Registrar", "Medicine: Registrar"]))).toEqual([
      "Medicine",
      "ICU",
      "Orthopaedics",
    ]);
  });
});

describe("the switchboard", () => {
  it("is the contact titled Switchboard with no prefix", () => {
    const items = contacts(["Medicine: Switchboard", "Switchboard", "Ward: 4B"]);
    expect(switchboardItem(items)?.title).toBe("Switchboard");
    expect(switchboardItem(contacts(["Ward: 4B"]))).toBeNull();
  });
});

describe("the hospital's own after-hours times (Stage B)", () => {
  const HOURS = { afterHoursFrom: "17:30", afterHoursUntil: "08:00" };
  // Perth is UTC+8 all year.
  const at = (iso: string) => new Date(iso);

  it("does not adapt at all until the hospital sets its times", () => {
    expect(onCallHospitalPeriod(null, at("2026-09-26T14:00:00.000Z"))).toBeNull();
    expect(onCallHoursTrack(null, at("2026-09-26T14:00:00.000Z"))).toBeNull();
  });

  it("reads the window across midnight", () => {
    expect(onCallHospitalPeriod(HOURS, at("2026-09-26T18:10:00.000Z"))).toBe("after-hours"); // 02:10
    expect(onCallHospitalPeriod(HOURS, at("2026-09-26T02:00:00.000Z"))).toBe("in-hours"); // 10:00
    expect(onCallHospitalPeriod(HOURS, at("2026-09-26T09:30:00.000Z"))).toBe("after-hours"); // 17:30
    expect(onCallHospitalPeriod({ afterHoursFrom: "9am", afterHoursUntil: "08:00" }, new Date())).toBeNull();
  });

  it("draws the track as two spans around midnight, with now placed on the day", () => {
    const track = onCallHoursTrack(HOURS, at("2026-09-26T18:10:00.000Z"));
    expect(track?.spans).toEqual([
      { from: 0, to: 33.33 },
      { from: 72.92, to: 100 },
    ]);
    expect(track?.now).toBeCloseTo(9.03, 1);
  });
});

describe("Needs you", () => {
  const step = (order: number, whoToCall: string, phone: string | null): OnCallCallNowStep => ({
    order,
    whoToCall,
    when: "Synthetic example only",
    phone,
    hours: "any",
    appliesNow: true,
  });
  const LADDER: OnCallLadder = {
    id: "ladder-1",
    title: "Synthetic deteriorating patient",
    steps: [step(1, "Nurse in charge", null), step(2, "Registrar", "9000 0012"), step(3, "Consultant", "9000 0010")],
  };

  it("names the rung called from any row that dials the same number, and the next rung", () => {
    const needs = selectNeedsYou({
      ladders: [LADDER],
      marks: [{ entryId: "handbook-reg", calledAt: "2026-09-26T18:04:00.000Z" }],
      dialKeys: new Map([["handbook-reg", "tel:0890000012"]]),
    });
    expect(needs).toMatchObject({ waitingOn: "Registrar", calledAt: "2026-09-26T18:04:00.000Z" });
    expect(needs?.next.whoToCall).toBe("Consultant");
    expect(onCallDialKey(needs?.next.dial ?? null)).toBe("tel:0890000010");
  });

  it("moves on once the next rung is rung from Now itself", () => {
    const needs = selectNeedsYou({
      ladders: [LADDER],
      marks: [
        { entryId: "handbook-reg", calledAt: "2026-09-26T18:04:00.000Z" },
        { entryId: onCallLadderStepMarkId("ladder-1", 3), calledAt: "2026-09-26T18:15:00.000Z" },
      ],
      dialKeys: new Map([["handbook-reg", "tel:0890000012"]]),
    });
    // The consultant was the last rung: nothing further to offer.
    expect(needs).toBeNull();
  });

  it("shows nothing when no call matches a ladder step", () => {
    expect(
      selectNeedsYou({
        ladders: [LADDER],
        marks: [{ entryId: "other", calledAt: "2026-09-26T18:04:00.000Z" }],
        dialKeys: new Map([["other", "tel:0890000099"]]),
      }),
    ).toBeNull();
    expect(selectNeedsYou({ ladders: [], marks: [], dialKeys: new Map() })).toBeNull();
  });
});
