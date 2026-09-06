import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNeverSaysAgain, expectSays } from "./helpers/ward-caption";

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

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
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
      ...FIXTURE_HISTORY,
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

/**
 * Every admission actually shown in the "currently admitted" section, read off the per-admission
 * testid rather than counted by list-item role. The FACT this file's central falsifier proves is
 * "exactly this person appears here, and that other one does not" — a fact a rendered `<li>` and a
 * rendered `<tr>` state equally well, so the count is taken from the testid the row carries in
 * either shape rather than from `getAllByRole("listitem")`, which only the `<li>` shape satisfies.
 */
function admittedIds(): string[] {
  return [...document.querySelectorAll('[data-testid^="ward-community-admitted-AD-"]')].map(
    (el) => el.getAttribute("data-testid") ?? "",
  );
}

describe("community hub — an unknown team is never another team", () => {
  it("says no team matches, and renders no list at all", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam("atlantis", [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expectSays(screen.getByTestId("ward-community-unresolved").textContent, "the empty team search", [
      "no community team",
      "no match",
    ]);
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
    expect(admittedIds()).toHaveLength(1);
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
    expect(admittedIds()).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-A")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted-AD-B")).toBeNull();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("1");
    first.unmount();

    // The converse, on the same fixture: the exclusion above is a consequence of the referral and
    // not of one person being invisible everywhere.
    renderTeam(TEAM_B.id, both, [toA, toB]);
    expect(admittedIds()).toHaveLength(1);
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
    expect(admittedIds()).toHaveLength(2);
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
    expectSays(text, "the unattributed-admissions count", ["0 admission"]);
    expectSays(text, "the attribution note", ["named this team", "names this team"]);
    expectSays(text, "the not-a-catchment caveat", ["not a picture of an area", "not an area"]);
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
    expectSays(notice, "the follow-up provenance note", ["follow-up", "admission"]);
    /*
     * ⚠️ **THIS BANNED ONE EXACT SENTENCE UNTIL 2026-09-06, AND THE CLAIM IT GUARDS IS TRIVIAL TO
     * RESTATE.** The false version said the field is not recorded anywhere in this prototype;
     * `Admission.followUp` exists, carries a state, an instant and a role, and is seeded. Any of
     * "there is no such field", "the model has no field for it", "we do not hold that" says the same
     * false thing and walked straight past a single-string ban.
     *
     * The true claim is narrower and is asserted separately, by the model rather than by wording:
     * the field has NO PRODUCER — see "no reducer event gives Admission.followUp a value" in this
     * file, which reads the reducer and goes red if that stops being true. **A ban on wording and a
     * check on the model guard different halves, and neither substitutes for the other**: the model
     * check cannot see the page tell a lie about the schema, and this cannot see the schema change.
     */
    expectNeverSaysAgain(notice, "the follow-up provenance note", [
      "is not recorded anywhere",
      "no such field",
      "has no field",
      "does not exist in this prototype",
      "is not held anywhere",
      "nothing in the model records",
    ]);
    expectSays(notice.toLowerCase(), "the follow-up caveat", ["does not mean", "followed up"]);
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
    // ⚠️ Widened past the two exact strings, because a claim the model cannot express is still
    // unexpressible when it is rephrased — the original pin would pass on "everyone has follow-up".
    // Spellings chosen so they CANNOT collide with the honest copy on this same page, which says
    // "does not mean everybody is being followed up": a naive ban on "followed up" would go red on
    // correct work, which is the failure this whole pass exists to remove.
    expectNeverSaysAgain(page, "the community hub", [
      "no follow-up arranged",
      "nobody is missing follow-up",
      "no one is missing follow-up",
      "everybody has follow-up",
      "everyone has follow-up",
      "all follow-up arranged",
    ]);
    // Non-vacuity: the scan must actually have text to search.
    expect(page.length).toBeGreaterThan(500);
  });
  /**
   * 🔴 **THE BAN ABOVE IS A LIST OF WORDINGS. THIS IS THE FACT THAT MAKES IT LEGITIMATE, AND UNTIL
   * NOW NOTHING HELD IT.**
   *
   * The page must never claim a patient's follow-up is arranged because `Admission.followUp` has no
   * producer: it exists, it carries the vocabulary ["arranged", "not_arranged"], the seed writes it
   * — and **no reducer event can set one**, so a value on screen would be describing fixture data as
   * though a ward had done something. A ban on sentences cannot see that premise change: a rewrite
   * that gave the field a producer would leave every spelling above green while the ban quietly
   * became wrong.
   *
   * ⚠️ **AND THE NEAREST EXISTING GUARD PINS THE PROSE ABOUT THIS, NOT THE PROPERTY.**
   * `ward-community-corrected-claims.test.ts` asserts that the explanatory comment still contains
   * "no producer and no consumer" — which is true of a sentence, and stays true when the code stops
   * matching it. This asserts the code.
   *
   * Comments are dropped before the scan, because the comment explaining this very rule names the
   * field and would otherwise satisfy the check that describes it.
   */
  it("no reducer event gives Admission.followUp a value, which is why the wordings above are banned", () => {
    const reducer = readFileSync("src/components/ward-management/ward-flow-reducer.ts", "utf8");
    const executable = reducer.split("\n").filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    });

    const FIELD = "followUp:";
    const writes = executable
      .filter((line) => line.includes(FIELD))
      .map((line) =>
        line
          .slice(line.indexOf(FIELD) + FIELD.length)
          .split(",")[0]
          .trim(),
      );

    // ⚠️ FLOORED ON THE POPULATION WALKED, NEVER ON THE FINDINGS. Renaming the field takes this to
    // zero writes, and "every write is null" is trivially true of no writes — the vacuous green.
    // A rename must go RED here, because it means the ban above is guarding a premise that moved.
    expect(
      writes.length,
      "no `followUp:` write found anywhere in the reducer. Either the field was renamed — in which " +
        "case the follow-up wording ban above is guarding a premise that has moved and must be " +
        "re-derived — or this scan is broken. Neither is evidence that nothing writes one.",
    ).toBeGreaterThan(0);

    expect(
      writes.filter((value) => value !== "null"),
      "a reducer event now writes a non-null `Admission.followUp`. The field has gained a producer, " +
        "so 'nothing can arrange follow-up' has stopped being true — take the wording ban above back " +
        "to the owner rather than widening it.",
    ).toEqual([]);
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
    expectSays(footnote, "the return caveat", ["came back", "returned"]);
  });
});

describe("community hub — the list that cannot be built", () => {
  it("renders the referrals section with a statement and no list at all", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    const section = screen.getByTestId("ward-community-referrals");
    const statement = within(section).getByTestId("ward-community-referrals-unattributable").textContent ?? "";
    expectSays(statement, "the raised-by attribution refusal", ["cannot be attributed", "not attributable"]);
    expectSays(statement, "the raised-by attribution refusal", ["source side", "no team"]);
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
    // ⚠️ The retired wording, plus the rephrasings that would restore the same withdrawn claim.
    // A ban on three exact sentences is defeated by anyone who paraphrases them — which is what a
    // redesign does — so the guard has to forbid the CLAIM, not the sentence that carried it.
    expectNeverSaysAgain(page, "the community hub's departure rows", [
      "The date itself is not shown",
      "the date is not shown",
      "No row above says when somebody left",
      "no row says when somebody left",
      "The ward has written down an expected discharge date",
      "the ward has recorded an expected discharge date",
    ]);

    // What the rows say INSTEAD of an instant: elapsed time, in both directions.
    expect(screen.getByTestId("ward-community-expected-AD-DATED").textContent).toContain(
      "Expected discharge in 3 days",
    );
    expectSays(
      screen.getByTestId("ward-community-discharged-AD-HOME").textContent,
      "the elapsed-since-departure figure",
      ["5 weeks", "left"],
    );
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

    expectSays(
      screen.getByTestId("ward-community-discharged-AD-34").textContent,
      "the elapsed-since-departure figure",
      ["4 weeks", "left"],
    );
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

    expectSays(
      screen.getByTestId("ward-community-discharged-AD-6D").textContent,
      "the elapsed-since-departure figure",
      ["6 days", "left"],
    );
    expectSays(
      screen.getByTestId("ward-community-discharged-AD-7D").textContent,
      "the elapsed-since-departure figure",
      ["1 week", "left"],
    );
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
    expectSays(row, "the overdue-expected-date figure", ["1 week", "expected"]);
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
    expectSays(row, "the unrecorded-departure line", ["not recorded", "left"]);
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

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * THIRD EDITION — the referral queue and "admitted while already with this team".
 *
 * Everything below guards the CLAIM and the CLINICAL PROPERTY, never the rendering: no pinned
 * sentence, no class name, no DOM shape, no positional column index. Table columns are read by
 * their HEADER NAME, resolved at render time from the real `<thead>`, so a restyle of this panel
 * cannot break these tests the way a restyle would break a test that read `cells[3]`.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

/** One referral naming `teamName`, raised at `raisedAt`, through the reducer's own write path —
 *  never constructed by hand, so its shape is a shape the live system actually produces. Returns
 *  the state it landed in (for a caller that wants to accept it next) alongside the referral. */
function raiseTeamReferral(
  state: ReturnType<typeof seedWardFlowState>,
  teamName: string,
  raisedAt: number,
): { state: ReturnType<typeof seedWardFlowState>; referral: Referral } {
  const before = state.referrals.length;
  const next = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: raisedAt,
    ageBand: "Adult",
    destinations: [{ kind: "community_team", teamName }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(next.rejections, "the fixture referral was refused").toEqual([]);
  const created = next.referrals.slice(before);
  expect(created, "the reducer did not create the fixture referral").toHaveLength(1);
  return { state: next, referral: created[0] };
}

/** `referral` accepted by the network at `decidedAt`, as `coordinator` — the one role this
 *  reducer lets answer ANY destination kind (`CO-D2`), so it is the realistic way a community
 *  destination ever reaches `"accepted"` today; the community hub itself offers no such control
 *  (see the "the team's own queue offers no way to decide" describe block below). */
function acceptTeamReferral(
  state: ReturnType<typeof seedWardFlowState>,
  referralId: string,
  decidedAt: number,
): ReturnType<typeof seedWardFlowState> {
  const next = wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    role: "coordinator",
    now: decidedAt,
    referralId,
    destinationKind: "community_team",
  });
  expect(next.rejections, "the fixture acceptance was refused").toEqual([]);
  return next;
}

/** The `<td>`/`<th>` text under a header name, resolved from the real `<thead>` rather than a
 *  hard-coded index — exactly what the brief asks for: address a column by its name, not its
 *  position, so a reordered or renamed column fails loudly instead of silently comparing the
 *  wrong cell. */
function cellByHeader(table: HTMLElement, row: HTMLElement, headerName: string): string {
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim());
  const index = headers.indexOf(headerName);
  expect(index, `no column named "${headerName}" in this table (headers: ${headers.join(", ")})`).toBeGreaterThan(-1);
  // `th[scope=row]` and `td` together, in DOM order — the same order the headers were read in, so
  // the two arrays line up by position without either being read by a hard-coded index.
  const cells = Array.from(row.querySelectorAll("th, td"));
  return cells[index]?.textContent?.trim() ?? "";
}

const ACCEPTED_TEAM = COMMUNITY_TEAM_PAGES[2];

describe("admitted while already with this team — the acceptance-before-admission rule", () => {
  /**
   * ⚠️ **THE FLOOR.** One fixture, three admissions, each forcing a different one of the three
   * outcomes `categoriseTeamAdmission` can produce. If the seed only ever produced one shape, every
   * assertion below would pass vacuously — this walks the population and proves it is not vacuous
   * before drawing any conclusion from it.
   */
  function buildThreeShapeFixture() {
    let state = seedWardFlowState();

    // Shape 1: accepted well before the bed began — belongs in the table.
    const acceptedEarly = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 20 * MINUTES_PER_DAY);
    state = acceptTeamReferral(acceptedEarly.state, acceptedEarly.referral.id, NOW_ANCHOR - 15 * MINUTES_PER_DAY);
    // ⚠️ Re-read the referral from the state the acceptance actually landed in. Keeping the
    // pre-acceptance object here is the bug this comment exists to prevent: it still reads
    // "queued", so the admission below would never resolve to "accepted-before-admission" at all.
    const acceptedEarlyReferral = state.referrals.find((referral) => referral.id === acceptedEarly.referral.id)!;
    const admittedAfterAcceptance = admission({
      id: "AD-ACCEPTED-FIRST",
      referralId: acceptedEarlyReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 5 * MINUTES_PER_DAY,
    });

    // Shape 2: the bed began first, and the referral to this team came afterwards — the ward
    // reaching out during an admission that is still open. Must be EXCLUDED from the table.
    const referredLate = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 10 * MINUTES_PER_DAY);
    state = acceptTeamReferral(referredLate.state, referredLate.referral.id, NOW_ANCHOR - 8 * MINUTES_PER_DAY);
    const referredLateReferral = state.referrals.find((referral) => referral.id === referredLate.referral.id)!;
    const admittedBeforeReferral = admission({
      id: "AD-REFERRED-DURING",
      referralId: referredLateReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 30 * MINUTES_PER_DAY,
    });

    // Shape 3: a bed pulled for this team and nobody has arrived yet — no admission start exists
    // to compare an acceptance against, so this can be neither of the other two.
    const pulledFor = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 3 * MINUTES_PER_DAY);
    state = pulledFor.state;
    const bedPulled = admission({
      id: "AD-PULLED",
      referralId: pulledFor.referral.id,
      state: "pulled",
      pulledAt: NOW_ANCHOR - 1 * MINUTES_PER_DAY,
      arrivedAt: null,
    });

    return {
      referrals: [acceptedEarlyReferral, referredLateReferral, pulledFor.referral],
      admissions: [admittedAfterAcceptance, admittedBeforeReferral, bedPulled],
    };
  }

  it("floors the population: the fixture really does produce both an included and an excluded admission", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    // Non-vacuity on the fixture itself, independent of the rendered page: three admissions, three
    // distinct referrals, none colliding.
    expect(admissions).toHaveLength(3);
    expect(new Set(referrals.map((referral) => referral.id)).size).toBe(3);
  });

  it("includes only the admission this team accepted BEFORE the bed began", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    const table = screen.getByTestId("ward-community-accepted-before-admission-table");
    expect(within(table).queryByTestId("ward-community-accepted-before-admission-AD-ACCEPTED-FIRST")).toBeTruthy();
    expect(within(table).queryByTestId("ward-community-accepted-before-admission-AD-REFERRED-DURING")).toBeNull();
    expect(within(table).queryByTestId("ward-community-accepted-before-admission-AD-PULLED")).toBeNull();
  });

  it("excludes a referral raised during the admission the person is still in, and names it in the other-groups count", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    const otherGroups = screen.getByTestId("ward-community-accepted-before-admission-other-groups").textContent ?? "";
    // One admission referred during its own bed (AD-REFERRED-DURING), one bed pulled with nobody
    // arrived (AD-PULLED) — both real counts, read from the same fixture the table renders.
    expectSays(otherGroups, "the referred-during-stay count", ["1 admission", "referred"]);
    expectSays(otherGroups, "the pulled-not-arrived count", ["1 ", "bed pulled"]);
  });

  it("reads the acceptance-before-admission gap by its column header, not by position", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    const table = screen.getByTestId("ward-community-accepted-before-admission-table");
    const row = within(table).getByTestId("ward-community-accepted-before-admission-AD-ACCEPTED-FIRST");
    // 15 days accepted before now, 5 days into the bed — the gap between acceptance and arrival is
    // 10 days, resolved by the column NAMED "Accepted before the bed began".
    const gapCell = cellByHeader(table, row, "Accepted before the bed began");
    expect(gapCell.length, "the gap column rendered nothing").toBeGreaterThan(0);
    expect(gapCell.toLowerCase()).not.toContain("overdue");
  });

  it("never claims, in any heading or sentence, that a person is currently or actively with the team", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    // The NEGATIVE half is a page-wide ban and must stay page-wide: a forbidden claim anywhere on
    // the screen is the defect, so narrowing this would be the bug, not the fix.
    const page = (document.body.textContent ?? "").toLowerCase();
    for (const forbidden of ["currently active with", "actively with this team", "currently with this team"]) {
      expect(page, `the page claims active care with the forbidden phrase "${forbidden}"`).not.toContain(forbidden);
    }

    /*
     * 🔴 **THE POSITIVE HALF READ THE WHOLE PAGE UNTIL 2026-09-05, AND THAT MADE IT UNABLE TO FAIL.**
     * A second paragraph further down repeats "no team discharge, no episode end", so both concepts
     * were satisfied by a sentence that is not this caveat. Measured, not argued: deleting the whole
     * `<p data-testid="ward-community-accepted-before-admission-not-active-claim">` from
     * `community-screen.tsx` — the caveat gone from the screen entirely — left this test GREEN.
     *
     * That caveat is the only thing stopping a coordinator reading the table above as "these people
     * are currently under this team's care", which the record cannot support. Pointed at its own
     * element, the same deletion now fails on the missing testid before any wording is compared.
     *
     * ⚠️ The fix is the ELEMENT, not the wording. Do not repair a future red here by adding
     * spellings: a longer list makes a guard that already cannot fail harder to fail.
     */
    const caveat = screen.getByTestId("ward-community-accepted-before-admission-not-active-claim");
    expectSays(caveat, "the still-with-team caveat", ["does not say", "still with"]);
    expectSays(caveat, "the still-with-team caveat", ["no team discharge", "no episode end"]);
  });

  it("carries no colour or emphasis keyed to the size of the gap: two very different gaps render identically apart from their own id", () => {
    let state = seedWardFlowState();
    const short = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 6 * MINUTES_PER_DAY);
    state = acceptTeamReferral(short.state, short.referral.id, NOW_ANCHOR - 5 * MINUTES_PER_DAY);
    const shortReferral = state.referrals.find((referral) => referral.id === short.referral.id)!;
    const shortGapAdmission = admission({
      id: "AD-SHORT-GAP",
      referralId: shortReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 4 * MINUTES_PER_DAY,
    });

    const long = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 400 * MINUTES_PER_DAY);
    state = acceptTeamReferral(long.state, long.referral.id, NOW_ANCHOR - 380 * MINUTES_PER_DAY);
    const longReferral = state.referrals.find((referral) => referral.id === long.referral.id)!;
    const longGapAdmission = admission({
      id: "AD-LONG-GAP",
      referralId: longReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 4 * MINUTES_PER_DAY,
    });

    renderTeam(ACCEPTED_TEAM.id, [shortGapAdmission, longGapAdmission], [shortReferral, longReferral]);

    const table = screen.getByTestId("ward-community-accepted-before-admission-table");
    const shortRow = within(table).getByTestId("ward-community-accepted-before-admission-AD-SHORT-GAP");
    const longRow = within(table).getByTestId("ward-community-accepted-before-admission-AD-LONG-GAP");
    // Same class list on both rows regardless of a roughly sixty-fold difference in the gap they
    // render — the only thing distinguishing them is their own identity, never a rule keyed to
    // how long the gap is.
    expect(shortRow.className).toBe(longRow.className);
    expect(shortRow.hasAttribute("data-tone")).toBe(false);
    expect(longRow.hasAttribute("data-tone")).toBe(false);
  });

  it("says nobody accepted-before-admission in words, when there is nobody, and never a bare dash or blank", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [admission({ id: "AD-A", referralId: toTeam.id, state: "occupied" })], [toTeam]);

    const empty = screen.getByTestId("ward-community-accepted-before-admission-empty").textContent ?? "";
    expect(empty.length).toBeGreaterThan(10);
    expect(empty.trim()).not.toBe("");
    expect(empty.trim()).not.toBe("-");
    expect(empty.trim()).not.toBe("—");
  });
});

describe("waiting for your answer — the team's own queue, and why it offers no way to decide", () => {
  it("shows a referral whose addressing to this team is still queued", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [], [toTeam]);

    expect(screen.getByTestId(`ward-community-waiting-${toTeam.id}`)).toBeTruthy();
  });

  it("excludes a referral once this team's addressing has been answered", () => {
    let state = seedWardFlowState();
    const raised = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 2 * MINUTES_PER_DAY);
    state = acceptTeamReferral(raised.state, raised.referral.id, NOW_ANCHOR - 1 * MINUTES_PER_DAY);
    const accepted = state.referrals.find((referral) => referral.id === raised.referral.id)!;

    renderTeam(ACCEPTED_TEAM.id, [], [accepted]);

    expect(screen.queryByTestId(`ward-community-waiting-${accepted.id}`)).toBeNull();
    expect(screen.getByTestId("ward-community-waiting-empty")).toBeTruthy();
  });

  it("offers no button that could accept or decline, and says why", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [], [toTeam]);

    const panel = screen.getByTestId("ward-community-waiting");
    expect(within(panel).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByTestId("ward-community-waiting-not-actionable").textContent).toContain(
      "Accepting or declining a referral is not available from this page",
    );
  });
});

describe("the discharged-into-the-area caveat renders above its list, never below", () => {
  it("puts the follow-up notice before the list (or its empty state) in document order", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [admission({ id: "AD-A", referralId: toTeam.id, state: "occupied" })], [toTeam]);

    const section = screen.getByTestId("ward-community-discharged");
    const notice = within(section).getByTestId("ward-community-follow-up-not-recorded");
    const emptyOrList =
      within(section).queryByTestId("ward-community-discharged-list") ??
      within(section).getByTestId("ward-community-discharged-empty");

    // DOCUMENT_POSITION_FOLLOWING means the second node comes after the first — i.e. the notice is
    // above the list it qualifies, not read-able-past on the way down to an empty one.
    const relation = notice.compareDocumentPosition(emptyOrList);
    expect(Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING), "the follow-up notice is not above its list").toBe(
      true,
    );
  });
});

describe("the KPI figures state absence in words, never a bare zero rendered as nothing", () => {
  it("says 'None waiting' rather than a bare number when nobody is waiting on this team", () => {
    renderTeam(ACCEPTED_TEAM.id, [], []);

    const longestWaitLabel = screen.getByText("Longest wait");
    const figure = longestWaitLabel.closest('[data-ward-primitive="figure"]');
    expect(figure, "the Longest wait figure tile was not found").toBeTruthy();
    expect(figure?.textContent).toContain("None waiting");
  });
});
