import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` and the team switcher render next/link
// anchors, and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen, communityTeamHref } from "@/components/ward-management/community/community-screen";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COMMUNITY HUB, ON THE SCREEN, AFTER THE ASSOCIATION RULE WAS REVERSED.
 *
 * ⚠️ **THIS FILE REPLACES A REGION-BASED ONE AND PORTS NONE OF ITS ASSERTIONS.** The previous DOM
 * suite rendered team pages keyed on `admission.homeRegion === team.region`. The owner ruled on
 * 2026-08-31 that a person belongs to the team NAMED ON THEIR REFERRAL and that home region is a
 * geographic guess; region is gone from the module entirely. Adapting those assertions would have
 * produced a guard that protects the defect, so they are not adapted — they are replaced.
 *
 * ⚠️ **THE FALSIFIER THIS FILE IS BUILT AROUND.** Almost any rendering assertion here would also
 * pass against a screen that associated people by home region, because in ordinary fixtures the
 * region and the referred team agree. So the central test builds two people with the SAME home
 * region and DIFFERENT referral teams and asserts the page shows exactly ONE of them, plus the
 * converse on the other team's page. A region-keyed screen shows both on one page and neither on
 * the other; no implementation can satisfy both directions.
 *
 * ⚠️ **THE SENTENCES ARE ASSERTED, NOT ONLY THE ROWS.** `tests/ward-community-hub.test.ts` already
 * proves the four lists partition correctly. What only a rendered page can prove is that an empty
 * list never reads as an all-clear: the follow-up statement is asserted on a team whose discharged
 * list IS empty, and the invisible-cohort line is asserted on a fixture where the count IS nought.
 * A safety statement that vanishes at nought is one nobody ever sees.
 */

/**
 * A fully-populated admission, minted rather than found, so populations the seed cannot produce are
 * still renderable. Typed as `Admission`, so a field added to the record fails to compile here
 * rather than leaving this helper silently building a stale shape.
 */
function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-01",
    unitId: "unit-under-test",
    specialling: false,
    referralId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: 0,
    arrivedAt: 0,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

/**
 * Referrals naming community teams, built through the reducer's own write path so the shape they
 * hold is a shape the live system actually produces.
 *
 * ⚠️ **ONE CHAIN, NEVER ONE SEED PER REFERRAL, and that is a correctness requirement rather than
 * tidiness.** Two calls to `seedWardFlowState()` each mint the SAME next referral id, so two
 * independently-seeded referrals collide, `referrals.find(id)` returns the first, and a person
 * referred to team B is reported as belonging to team A — a false result shaped exactly like the
 * defect this file exists to catch, and the way a green suite hides one. The distinct ids are
 * asserted below rather than assumed. Same pattern as `tests/ward-community-hub.test.ts`.
 */
function referralsNaming(teamNames: readonly string[], homeRegion: Referral["homeRegion"]): Referral[] {
  let state = seedWardFlowState();
  const before = state.referrals.length;
  for (const teamName of teamNames) {
    state = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "community_team", teamName }],
      homeRegion,
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
    });
    expect(state.rejections, `the reducer refused a referral naming ${teamName}`).toEqual([]);
  }
  const created = state.referrals.slice(before);
  expect(created, "the reducer did not create one referral per requested team").toHaveLength(teamNames.length);
  expect(new Set(created.map((referral) => referral.id)).size, "two fixture referrals share an id").toBe(
    teamNames.length,
  );
  return created;
}

const TEAM_A = COMMUNITY_TEAM_PAGES[0];
const TEAM_B = COMMUNITY_TEAM_PAGES[1];

/**
 * Both data props are supplied on every render, always together. The screen falls back to live
 * provider state for either one independently, and a test that supplied admissions alone would
 * render a page that is empty for the wrong reason — nobody's referral would resolve — while
 * looking exactly like a correct empty page.
 *
 * `initialNow` is pinned so the provider's clock cannot move under a length-of-stay figure.
 */
function renderTeam(teamId: string, admissions: Admission[], referrals: Referral[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={teamId} admissions={admissions} referrals={referrals} />
    </WardFlowProvider>,
  );
}

describe("community hub — an unknown team is never another team", () => {
  it("says no team matches, and renders no list at all", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam("atlantis", [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expect(screen.getByTestId("ward-community-unresolved").textContent).toContain("No community team matches");
    // A fallback would render one of these names in the heading, so the absence is asserted over
    // the whole page rather than over the heading alone.
    const page = document.body.textContent ?? "";
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(page, `the not-found page named ${team.name}`).not.toContain(team.name);
    }
    expect(screen.queryByTestId("ward-community-admitted")).toBeNull();
    expect(screen.queryByTestId("ward-community-discharged")).toBeNull();
    expect(screen.queryByTestId("ward-community-referrals")).toBeNull();
  });

  it("does not resolve a team's own name as an id", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.name, [admission({ id: "AD-A", referralId: toA.id })], [toA]);
    // If this ever resolved, the slug function has become the identity and ids carrying spaces and
    // brackets would be reaching the router.
    expect(screen.getByTestId("ward-community-unresolved")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted")).toBeNull();
  });
});

describe("community hub — who the page shows is who the referral named", () => {
  it("renders its own team's name, and the person referred to it", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id, state: "occupied" })], [toA]);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(TEAM_A.name);
    const list = screen.getByTestId("ward-community-admitted-list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-A")).toBeTruthy();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("1");
    // The rule is stated on the page, once, above every list that depends on it.
    expect(screen.getByTestId("ward-community-association").textContent).toContain(
      `a referral named ${TEAM_A.name} as a destination`,
    );
  });

  /**
   * ⚠️ **THE FALSIFIER. Same home region, different referral teams.**
   *
   * Under the rule the owner reversed, both of these people are on ONE page (whichever team serves
   * "Perth Metropolitan") and neither is on the other. Under the owner's rule they are on two
   * different pages and the region is never read. A screen that satisfied the old premise fails
   * both halves of this test.
   */
  it("⚠️ shows one of two people who share a home region, on each of the two teams they were referred to", () => {
    const [toA, toB] = referralsNaming([TEAM_A.name, TEAM_B.name], "Perth Metropolitan");
    const personA = admission({ id: "AD-A", referralId: toA.id, homeRegion: "Perth Metropolitan" });
    const personB = admission({ id: "AD-B", referralId: toB.id, homeRegion: "Perth Metropolitan" });
    const both = [personA, personB];

    const first = renderTeam(TEAM_A.id, both, [toA, toB]);
    expect(within(screen.getByTestId("ward-community-admitted-list")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-A")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted-AD-B")).toBeNull();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("1");
    first.unmount();

    // The converse, on the same fixture: the exclusion above is a consequence of the referral and
    // not of one person being invisible everywhere.
    renderTeam(TEAM_B.id, both, [toA, toB]);
    expect(within(screen.getByTestId("ward-community-admitted-list")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-B")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted-AD-A")).toBeNull();
  });

  it("⚠️ shows a person whose region matches nothing, and one with no region at all", () => {
    // The other direction of the same falsifier: a region-keyed screen renders neither of these,
    // because neither region can match the team serving Armadale.
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const farAway = admission({ id: "AD-FAR", referralId: toA.id, homeRegion: "Kimberley" });
    const noRegion = admission({ id: "AD-NONE", referralId: toA.id, homeRegion: null });

    renderTeam(TEAM_A.id, [farAway, noRegion], [toA]);
    expect(within(screen.getByTestId("ward-community-admitted-list")).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByTestId("ward-community-admitted-AD-FAR")).toBeTruthy();
    expect(screen.getByTestId("ward-community-admitted-AD-NONE")).toBeTruthy();
  });

  it("shows nobody when no referral named this team, and says so rather than showing an empty list silently", () => {
    const [toB] = referralsNaming([TEAM_B.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-B", referralId: toB.id })], [toB]);

    expect(screen.queryByTestId("ward-community-admitted-list")).toBeNull();
    expect(screen.getByTestId("ward-community-admitted-empty")).toBeTruthy();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("0");
  });
});

describe("community hub — the cohort that appears on no team's page", () => {
  it("states the count even when it is nought, because a line that vanishes at nought is never seen", () => {
    // Every admission in this fixture belongs to a team, so this IS the nought branch — asserted
    // rather than hoped for, since the sentence on the populated branch is worded differently.
    const [toA, toB] = referralsNaming([TEAM_A.name, TEAM_B.name], "Perth Metropolitan");
    renderTeam(
      TEAM_A.id,
      [admission({ id: "AD-A", referralId: toA.id }), admission({ id: "AD-B", referralId: toB.id })],
      [toA, toB],
    );

    const text = screen.getByTestId("ward-community-unattributable").textContent ?? "";
    expect(text).toContain("0 admissions are on no community team's page");
    expect(text).toContain("a referral NAMED this team");
    expect(text).toContain("It is not a picture of an area");
  });

  it("counts them when they exist, and shows them on no list", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    // No referral at all — every admission `PULL_PATIENT` creates during a session. Same home region as
    // the member beside it, so a region-keyed screen would have put it on a page.
    const orphan = admission({ id: "AD-ORPHAN", referralId: null, homeRegion: "Perth Metropolitan" });

    renderTeam(TEAM_A.id, [orphan], [toA]);
    expect(screen.getByTestId("ward-community-unattributable").textContent).toContain(
      "1 admission is on no community team's page",
    );
    expect(screen.getByTestId("ward-community-admitted-empty")).toBeTruthy();
    expect(screen.getByTestId("ward-community-discharged-empty")).toBeTruthy();
    expect(screen.getByTestId("ward-community-expected-empty")).toBeTruthy();
  });
});

describe("community hub — an empty list must never read as an all-clear", () => {
  it("says follow-up is not recorded, inside the discharged section, on a team whose list is empty", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id, state: "occupied" })], [toA]);

    const section = screen.getByTestId("ward-community-discharged");
    // The branch under test is genuinely the empty one — otherwise this asserts the wording on a
    // populated list and proves nothing about the case that matters.
    expect(within(section).getByTestId("ward-community-discharged-empty")).toBeTruthy();
    const notice = within(section).getByTestId("ward-community-follow-up-not-recorded").textContent ?? "";
    // ⚠️ Wording corrected 2026-09-01. This used to pin "…is not recorded", which was FALSE:
    // `Admission.followUp` exists, carries a state/instant/role, and is seeded. What is true is that
    // nothing writes it and nothing reads it. The negative pin below is what stops the false version
    // returning; see `tests/ward-community-index.test.ts` for the full pin and the measurement.
    expect(notice).toContain("Whether follow-up has been arranged is recorded on the admission");
    expect(notice, "the false 'no such field' claim has come back").not.toContain(
      "is not recorded anywhere in this prototype",
    );
    expect(notice.toLowerCase()).toContain("does not mean everybody is being followed up");
  });

  it("carries the same wording on a team that DOES have a discharge, so it is not an empty-state message", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const wentHome = admission({
      id: "AD-HOME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR,
    });

    renderTeam(TEAM_A.id, [wentHome], [toA]);
    const section = screen.getByTestId("ward-community-discharged");
    expect(within(section).getByTestId("ward-community-discharged-list")).toBeTruthy();
    expect(within(section).getByTestId("ward-community-discharged-AD-HOME")).toBeTruthy();
    expect(within(section).getByTestId("ward-community-follow-up-not-recorded").textContent).toContain(
      "Whether follow-up has been arranged is recorded on the admission",
    );
  });

  it("never writes the spec's own heading, which would assert the half the model cannot express", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    const page = (document.body.textContent ?? "").toLowerCase();
    expect(page).not.toContain("no follow-up arranged");
    expect(page).not.toContain("nobody is missing follow-up");
    // Non-vacuity: the scan must actually have text to search.
    expect(page.length).toBeGreaterThan(500);
  });

  it("accounts for the departures that are not on list 1 rather than dropping them", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const transferred = admission({
      id: "AD-MOVED",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "transferred-to-another-psychiatric-ward",
      leftAt: NOW_ANCHOR,
    });

    renderTeam(TEAM_A.id, [transferred], [toA]);
    // The person is not on list 1 — and is not silently gone either.
    expect(screen.getByTestId("ward-community-discharged-empty")).toBeTruthy();
    const footnote = screen.getByTestId("ward-community-other-departures").textContent ?? "";
    expect(footnote).toContain("1 other admission");
    // Deliberately trimmed before "into this area". The screen still carries region-era wording in
    // its headings and empty states (reported, not fixed here), and pinning that phrasing would make
    // this guard resist the copy correction rather than survive it.
    expect(footnote).toContain("None of those records says the person came back");
  });
});

describe("community hub — the list that cannot be built", () => {
  it("renders the referrals section with a statement and no list at all", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    const section = screen.getByTestId("ward-community-referrals");
    const statement = within(section).getByTestId("ward-community-referrals-unattributable").textContent ?? "";
    expect(statement).toContain("Referrals RAISED BY this team cannot be attributed");
    expect(statement).toContain("the source side carries no team");
    // A section that says why it is empty is honest; a list here would necessarily be a
    // fabrication, because nothing in the model says which team raised a referral.
    expect(within(section).queryByRole("list")).toBeNull();
  });
});

/**
 * ⚠️ **NO CALENDAR DATE OR CLOCK FACE IS EVER RENDERED — REWRITTEN 2026-09-01 RATHER THAN DELETED,
 * BECAUSE THE GUARANTEE SURVIVES IN A NARROWER FORM.**
 *
 * Until this change this block pinned that neither withheld field ever printed anything beyond "a
 * date is recorded" — the render was deliberately unchanged while only the file's account of WHY
 * changed. The owner has since ruled (2026-09-01) that once a duration can be computed soundly — see
 * the screen's header block: `INSTANT_FIELDS` names both fields, so `now - field` is sound on this
 * clock — it should be SHOWN, as elapsed time, never a calendar date. So what this block still owes
 * a reader is narrower but not weaker: no CALENDAR date and no clock face ever appears —
 * `formatInstant`'s "HH:MM" shape and `formatInstantWithDay`'s "yesterday"/"tomorrow" register are
 * both still forbidden — only a duration counted in days or weeks.
 *
 * The fixture below populates both fields deliberately, one in each direction — `expectedDischargeAt`
 * still ahead, `leftAt` well in the past — so the assertions prove the row for each field, not only
 * that the page rendered something.
 */
describe("community hub — elapsed time is rendered, never a calendar date or clock face", () => {
  it("renders how long ago somebody left and how far off the expected date sits, never an instant", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const dated = admission({
      id: "AD-DATED",
      referralId: toA.id,
      state: "occupied",
      expectedDischargeAt: NOW_ANCHOR + 3 * MINUTES_PER_DAY,
    });
    const wentHome = admission({
      id: "AD-HOME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 35 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [dated, wentHome], [toA]);
    // Non-vacuity: both instant-carrying rows really are on the page.
    expect(screen.getByTestId("ward-community-expected-AD-DATED")).toBeTruthy();
    expect(screen.getByTestId("ward-community-discharged-AD-HOME")).toBeTruthy();

    const page = document.body.textContent ?? "";
    // `formatInstant`'s output shape. Any HH:MM here means somebody put a clock face back.
    expect(page).not.toMatch(/\b\d{2}:\d{2}\b/);
    // `formatInstantWithDay`'s calendar-relative register — this screen speaks only in elapsed
    // days/weeks, never "yesterday"/"tomorrow".
    for (const relative of ["yesterday", "tomorrow"]) {
      expect(page.toLowerCase(), `the community hub renders "${relative}"`).not.toContain(relative);
    }

    // The retired "a date is recorded, and nothing more" wording must not have come back.
    expect(page).not.toContain("The date itself is not shown");
    expect(page).not.toContain("No row above says when somebody left");
    expect(page).not.toContain("The ward has written down an expected discharge date");

    // What the rows say INSTEAD of an instant: elapsed time, in both directions.
    expect(screen.getByTestId("ward-community-expected-AD-DATED").textContent).toContain(
      "Expected discharge in 3 days",
    );
    expect(screen.getByTestId("ward-community-discharged-AD-HOME").textContent).toContain("Left this ward 5 weeks ago");
  });
});

/**
 * ⚠️ **THE WEEK-ROUNDING BOUNDARY, PINNED EXACTLY — `community-elapsed.ts`'s ONE rule both fields
 * use.** "5 weeks ago" for 34 days and for 41 days are both defensible; what is not defensible is
 * nobody knowing which. This project floors, the same discipline `daysInBed` already holds for days:
 * a duration reads as a further week only once that whole day has actually completed, never on the
 * day before appearing close enough. So 34 days is still "4 weeks ago" and 35 days — the first day
 * a fifth full week is complete — is where "5 weeks ago" begins. Both sides of the boundary are
 * asserted so a future change that rounds the other way, or rounds nearest instead of down, fails
 * here rather than being noticed on a screen.
 */
describe("community hub — the week-rounding boundary is floored, and pinned on both sides", () => {
  it("does not cross into a further week until that whole day has completed", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const stillFourWeeks = admission({
      id: "AD-34",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 34 * MINUTES_PER_DAY,
    });
    const justFiveWeeks = admission({
      id: "AD-35",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 35 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [stillFourWeeks, justFiveWeeks], [toA]);

    expect(screen.getByTestId("ward-community-discharged-AD-34").textContent).toContain("Left this ward 4 weeks ago");
    expect(screen.getByTestId("ward-community-discharged-AD-34").textContent).not.toContain("5 weeks");
    expect(screen.getByTestId("ward-community-discharged-AD-35").textContent).toContain("Left this ward 5 weeks ago");
  });

  it("stays in whole days below one week, on both sides of that boundary", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const sixDays = admission({
      id: "AD-6D",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 6 * MINUTES_PER_DAY,
    });
    const oneWeek = admission({
      id: "AD-7D",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 7 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [sixDays, oneWeek], [toA]);

    expect(screen.getByTestId("ward-community-discharged-AD-6D").textContent).toContain("Left this ward 6 days ago");
    expect(screen.getByTestId("ward-community-discharged-AD-7D").textContent).toContain("Left this ward 1 week ago");
  });
});

/**
 * ⚠️ **THE TWO WITHHELD FIELDS ARE NOT THE SAME SHAPE — `expectedDischargeAt` CAN BE OVERDUE.**
 * `leftAt` is always past; `expectedDischargeAt` can be past or future, and `isPastExpectedDischarge`
 * exists precisely because a person can be overdue. An elapsed renderer applied blindly to both would
 * print "left −3 days ago" for someone not yet due. This screen still never spends the word
 * "overdue" (`tests/ward-community-hub.dom.test.tsx`'s "no threshold" test below still forbids it),
 * so the overdue direction is proved on its own wording: "was N ago" rather than a negative count.
 */
describe("community hub — an overdue expected date reads as overdue, not as a negative number", () => {
  it("says the plan is ahead when the date has not yet passed", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const stillAhead = admission({
      id: "AD-AHEAD",
      referralId: toA.id,
      state: "occupied",
      expectedDischargeAt: NOW_ANCHOR + 10 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [stillAhead], [toA]);

    expect(screen.getByTestId("ward-community-expected-AD-AHEAD").textContent).toContain(
      "Expected discharge in 1 week",
    );
  });

  it("says the plan has passed, in the past tense, when the ward is now overdue", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const overdue = admission({
      id: "AD-OVERDUE",
      referralId: toA.id,
      state: "occupied",
      expectedDischargeAt: NOW_ANCHOR - 10 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [overdue], [toA]);

    const row = screen.getByTestId("ward-community-expected-AD-OVERDUE").textContent ?? "";
    expect(row).toContain("Expected discharge was 1 week ago");
    // Never a negative count, and never the word this screen still does not use.
    expect(row).not.toMatch(/-\s*\d/);
    expect(row.toLowerCase()).not.toContain("overdue");
  });
});

/**
 * ⚠️ **NULL IS NOT ZERO.** A record with no `leftAt` has no elapsed time to state — it is a distinct
 * absence, not a duration of "0 days ago", and the wording for it is unchanged from before this
 * screen rendered elapsed time at all.
 */
describe("community hub — an unrecorded departure time is an absence, never a zero", () => {
  it("renders the same absence wording it always has, and no elapsed count", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const noDepartureTime = admission({
      id: "AD-NO-TIME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: null,
    });

    renderTeam(TEAM_A.id, [noDepartureTime], [toA]);

    const row = screen.getByTestId("ward-community-discharged-AD-NO-TIME").textContent ?? "";
    expect(row).toContain("Left this ward; the departure time was not recorded");
    expect(row).not.toContain("0 days");
    expect(row).not.toContain("today");
  });
});

describe("community hub — what it must never grow", () => {
  it("has no writable control anywhere: no handover note, no free text of any kind", () => {
    // FD-13 permits exactly one story field and it is on the referral. This is the screen where a
    // second one feels obviously necessary, so the absence is asserted rather than intended.
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll("input")).toHaveLength(0);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("[contenteditable]")).toHaveLength(0);
  });

  it("shows no threshold, no overdue and no invented interval", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(
      TEAM_A.id,
      [admission({ id: "AD-A", referralId: toA.id, expectedDischargeAt: NOW_ANCHOR + 4320 })],
      [toA],
    );

    const page = (document.body.textContent ?? "").toLowerCase();
    for (const forbidden of ["overdue", "breach", "deadline", "days to contact", "within 7 days"]) {
      expect(page, `the community hub renders "${forbidden}"`).not.toContain(forbidden);
    }
    expect(page.length).toBeGreaterThan(500);
  });

  it("says the team name is a placeholder from one source document, above every list", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expect(screen.getByTestId("ward-community-placeholder-notice").textContent).toContain(
      "This team name comes from one source document",
    );
  });
});

describe("community hub — the team switcher, and the route it resolves", () => {
  /**
   * The reachability figure `tests/ward-nav.test.ts` records for `community/[teamId]` counts
   * CONCRETE hrefs, and the switcher builds the rest of them. What it actually covers is
   * established here, by rendering the screen and reading the links back out of the markup.
   */
  it("links every other team, and never the page it is on", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    for (const team of [TEAM_A, TEAM_B]) {
      const { unmount } = renderTeam(team.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);
      const switcher = screen.getByRole("navigation", { name: "Other community teams" });
      const hrefs = within(switcher)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));

      expect(hrefs).toHaveLength(COMMUNITY_TEAM_PAGES.length - 1);
      expect(hrefs).not.toContain(communityTeamHref(team));
      for (const other of COMMUNITY_TEAM_PAGES) {
        if (other.id === team.id) continue;
        expect(hrefs, `${team.name} does not link ${other.name}`).toContain(communityTeamHref(other));
      }
      unmount();
    }
  });

  it("builds every href from the derived id, under the real route", () => {
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(communityTeamHref(team)).toBe(`/mockups/ward-flow/community/${team.id}`);
    }
  });
});
