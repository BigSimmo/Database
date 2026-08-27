import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Same reason as every sibling dom suite (ward-discharge-board.dom.test.tsx,
// ward-handover.dom.test.tsx, ward-ed-screen.dom.test.tsx): `ClinicalRail` renders next/link
// anchors and this suite never checks routing, so a plain <a> avoids an App Router context
// jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_SOURCES,
  SEXES,
  URGENCY_LEVELS,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/** Mirrors `ward-discharge-board.dom.test.tsx`'s own harness pattern: a real reducer-backed
 *  count, read off shared context, so a test can prove a dispatch actually happened (or did
 *  not) rather than only inspecting what the form's own DOM renders. */
function RejectionCount() {
  const { rejections } = useWardFlow();
  return <span data-testid="rejection-count">{rejections.length}</span>;
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
      <RejectionCount />
    </WardFlowProvider>,
  );
}

const EXPECTED_FIELD_TESTIDS = [
  "ward-referral-intake-ageBand",
  "ward-referral-intake-sex",
  "ward-referral-intake-homeRegion",
  "ward-referral-intake-secureBedNeeded",
  "ward-referral-intake-involuntaryBedNeeded",
  "ward-referral-intake-source",
  "ward-referral-intake-urgency",
  "ward-referral-intake-originSiteCode",
  "ward-referral-intake-transportNeeded",
];

function optionValues(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value);
}

describe("ReferralIntakeForm", () => {
  it("renders exactly one control for every field the model permits, and nothing else", () => {
    renderForm();

    for (const testId of EXPECTED_FIELD_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.getByTestId("ward-referral-intake-submit")).toBeInTheDocument();

    // Every data-testid on the page is unique — a duplicate is a guaranteed strict-mode
    // failure in the browser test (this already happened once this phase). getByTestId
    // itself throws on more than one match, so a bare call for each id above already proves
    // uniqueness for those; this asserts it for the DOM as a whole too.
    const { container } = renderForm();
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no free-text input of any kind anywhere on the form", () => {
    renderForm();

    const form = screen.getByTestId("ward-referral-intake-form");
    const freeTextControls = form.querySelectorAll(
      'input[type="text"], input[type="search"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]',
    );
    expect(freeTextControls).toHaveLength(0);
  });

  it("offers every age band from COHORTS — the four-time defect class this phase keeps hitting", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-ageBand");
    expect(optionValues(select)).toEqual([...COHORTS]);
  });

  it("offers every home region from HOME_REGIONS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-homeRegion");
    expect(optionValues(select)).toEqual([...HOME_REGIONS]);
  });

  it("offers every referral source from REFERRAL_SOURCES", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-source");
    expect(optionValues(select)).toEqual([...REFERRAL_SOURCES]);
  });

  it("offers every real network site as an origin option", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-originSiteCode");
    expect(optionValues(select)).toEqual(wardSites.map((site) => site.code));
  });

  it("offers every sex from SEXES — Task 5's fix for the same defect class COHORTS already closed", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-sex");
    expect(optionValues(select)).toEqual([...SEXES]);
  });

  it("offers every urgency tier from URGENCY_LEVELS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    expect(optionValues(select)).toEqual(URGENCY_LEVELS.map(String));
  });

  /**
   * Phase 7 Task 8, found by looking at the screen rather than by any test. The picker rendered a
   * bare "1", "2", "3" while the referral board rendered "Tier 2 · urgent" for the very same
   * field — two screens describing one field in two different words, which is this project's most
   * expensive defect class. It matters most here: this is the one screen where a human CHOOSES
   * the value rather than reading it back, on a phone, possibly from a police car, and neither
   * the digit nor the direction of the scale is self-evident to someone meeting it for the first
   * time.
   *
   * The existing test above could not catch it: it reads each option's `value` attribute, which
   * was correct throughout and is deliberately still the bare tier. This one reads the TEXT.
   *
   * Asserted against `urgencyTierLabel` itself rather than against three hard-coded strings, so
   * the guard is "the picker and the boards use one spelling", not "the picker uses the spelling
   * this test happens to remember". Two copies agreeing is what failed here; one export is why it
   * cannot fail the same way again.
   */
  it("labels every urgency option with its direction, in the same words the boards use", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    const optionText = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    // Non-vacuity: the labels really do carry a direction, so a future `urgencyTierLabel`
    // returning the bare tier again would fail here even though the line above still matched.
    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });

  it("describes the request, never the person, for the two need toggles", () => {
    renderForm();

    // The wording rule: "needs a secure bed", never "is a risk"; "needs a bed that can hold
    // someone involuntarily", never "is involuntary" — the requirement attaches to the
    // request, the word never attaches to the person.
    expect(screen.getByText(/needs a secure bed/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a bed that can hold someone involuntarily/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bis involuntary\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bis a risk\b/i)).not.toBeInTheDocument();
  });

  it("submits a well-formed referral with no rejection, using the fixed community role", () => {
    renderForm();

    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
    expect(screen.queryByTestId("ward-referral-intake-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-confirmation")).toBeInTheDocument();
  });

  it("surfaces a visible Rejection, rather than swallowing it, when the reducer refuses the intake", () => {
    renderForm();

    // No option on the real network carries an empty code, so setting the origin site select
    // to a value with no matching <option> leaves the DOM's own resolved value at "" (per the
    // HTMLSelectElement value-setter algorithm: no matching option -> selectedIndex -1 ->
    // value ""). `siteByCode("")` then resolves to nothing, and RECEIVE_REFERRAL's own
    // membership check (ward-flow-reducer.ts) refuses the event — a real reducer refusal, not
    // a fabricated one.
    fireEvent.change(screen.getByTestId("ward-referral-intake-originSiteCode"), {
      target: { value: "no-such-site" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("1");
    const rejection = screen.getByTestId("ward-referral-intake-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/must resolve to a real site/i);
    expect(screen.queryByTestId("ward-referral-intake-confirmation")).not.toBeInTheDocument();
  });
});

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralBoard />
    </WardFlowProvider>,
  );
}

describe("ReferralBoard", () => {
  it("renders exactly the real fixture's two queued referrals, in urgency-then-longest-wait order", () => {
    renderBoard();
    // RF-001 (raised 40 min ago) and RF-005 (raised 20 min ago) are both tier 2 in the real
    // fixture — RF-001 goes first because it has waited longer. See
    // tests/ward-referral-model.test.ts for the pure-function proof this table order is built on.
    const table = screen.getByTestId("ward-referral-board-queued-table");
    const ids = within(table)
      .getAllByRole("row")
      .slice(1) // drop the header row
      .map((row) => row.querySelector("td button")?.textContent);
    expect(ids).toEqual(["RF-001", "RF-005"]);
  });

  /**
   * Task 6. The intake form is deliberately absent from the rail (recorded against
   * `WARD_REFERRAL_INTAKE_HREF` in `WARD_NAV_INTENTIONALLY_UNLISTED`), which makes this board the
   * only way a coordinator reaches it. That makes the link load-bearing rather than decorative:
   * delete it and the intake route becomes unreachable from inside the running app while every
   * structural nav test stays green, because the exemption map still explains the absence.
   *
   * Asserted as an anchor with a real `href`, not merely as text: `router.push` from a click
   * handler would satisfy a "the words New referral appear" check while breaking middle-click,
   * hover preview and every static reachability scan.
   */
  it("offers the intake form as a real link, the only way into it now the rail deliberately omits it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const link = screen.getByTestId("ward-referral-board-new");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", WARD_REFERRAL_INTAKE_HREF);
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/referrals/new");
    expect(link.textContent?.trim()).toBe("New referral");
  });

  // M1 (fix round C): the figure must be bound to its OWN referral, not merely present. The
  // previous `/waiting/i` matched "40m waiting", "20m waiting", "0m waiting" and the bare word,
  // so rendering `referralWaitLabel(queued[0], now)` on every row — RF-001's wait shown against
  // RF-005 — survived it untouched. The real fixture raises RF-001 at NOW_ANCHOR - 40 and RF-005
  // at NOW_ANCHOR - 20, and this is the board's headline requirement, so the values are pinned.
  it("renders each queued referral's own waiting figure, not just the word 'waiting'", () => {
    renderBoard();
    expect(screen.getByTestId("ward-referral-board-wait-RF-001")).toHaveTextContent("40m waiting");
    expect(screen.getByTestId("ward-referral-board-wait-RF-005")).toHaveTextContent("20m waiting");
  });

  it("renders the real fixture's five decided referrals, most recently decided first", () => {
    renderBoard();
    // Real fixture decidedAt offsets from NOW_ANCHOR: RF-002 -10, RF-003 -15, RF-004 -25,
    // RF-006 -5, RF-007 -8 — most recent (smallest offset) first.
    const table = screen.getByTestId("ward-referral-board-decided-table");
    const ids = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td")?.textContent);
    expect(ids).toEqual(["RF-006", "RF-007", "RF-002", "RF-003", "RF-004"]);
  });

  /**
   * M3 (fix round C): `QueuedSection` and `DecidedSection` each map their array TWICE — once into
   * a table (the desk view) and once into `.cardList` (the corridor view at narrow widths). Both
   * existing order tests read only the tables, so a mutation reversing just the card `.map()` was
   * invisible to the whole suite. The module's own CSS comment says "a table is right at a desk
   * and wrong in a corridor"; the corridor view was the untested one. Card testids are asserted
   * rather than text because the card's own markup interleaves the id with the tier qualifier.
   */
  it("renders the queued cards in the same order as the queued table, for the phone view", () => {
    const { container } = renderBoard();
    const cards = Array.from(container.querySelectorAll("[data-testid^='ward-referral-board-card-select-']"));
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "ward-referral-board-card-select-RF-001",
      "ward-referral-board-card-select-RF-005",
    ]);
  });

  it("renders the decided cards in the same order as the decided table, for the phone view", () => {
    const { container } = renderBoard();
    const cards = Array.from(container.querySelectorAll("[data-testid^='ward-referral-board-decided-card-']"));
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "ward-referral-board-decided-card-RF-006",
      "ward-referral-board-decided-card-RF-007",
      "ward-referral-board-decided-card-RF-002",
      "ward-referral-board-decided-card-RF-003",
      "ward-referral-board-decided-card-RF-004",
    ]);
  });

  it("selecting a queued referral opens its match view, and none is open before that", () => {
    renderBoard();
    expect(screen.queryByTestId("ward-referral-match-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
    const panel = screen.getByTestId("ward-referral-match-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("RF-001");
  });

  /**
   * M7 (fix round C): the brief requires the "not a medical device" prose on BOTH screens. The
   * board's banner sits at the top of `<main>`, above two sections and two tables — the match
   * view mounts below all of it, so on a phone the coordinator taking the accept decision has
   * scrolled past it. Asserted on the match panel specifically, not on the document, so deleting
   * the match view's own copy cannot be masked by the board's.
   */
  it("the match view carries its own 'not a medical device' statement, where the decision is taken", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));

    const panel = screen.getByTestId("ward-referral-match-panel");
    const governance = within(panel).getByTestId("ward-referral-match-governance");
    expect(governance).toHaveTextContent(/not a medical device/i);
    expect(governance).toHaveTextContent(/never ranks units by suitability/i);
  });

  /**
   * M5 (fix round C): a `<button>`'s content model is phrasing content, and the queued card's
   * select button wrapped a `<div>` and a `<p>`. No sibling ward screen does this — the discharge
   * board's cards carry no button at all — so it was a new pattern rather than an inherited one.
   */
  it("the queued card's select button contains no flow content", () => {
    renderBoard();
    const button = screen.getByTestId("ward-referral-board-card-select-RF-001");
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelectorAll("div, p, ul, ol, section, h1, h2, h3")).toHaveLength(0);
  });

  it("every data-testid is unique, including with a match view open", () => {
    const { container } = renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("RF-001's match view: no bed accepts, and every unit still carries a reason — never an empty list", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-001"));

    expect(screen.getByTestId("ward-referral-match-no-bed")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-structural-gap")).not.toBeInTheDocument();
    // M2: the denominator is pinned to the real network size. `/^0 of \d+ units/` also matched
    // "0 of 0 units", so a mutation rendering `{accepting.length} of {accepting.length}` — or one
    // excluding forensic beds from the denominator — passed it.
    expect(screen.getByTestId("ward-referral-match-accepting-count")).toHaveTextContent(
      `0 of ${allUnits().length} units accept this referral right now.`,
    );

    const list = screen.getByTestId("ward-referral-match-list");
    const rows = within(list).getAllByRole("listitem");
    // I1 (fix round C, F4): the phase's headline clinical-safety property — every unit renders in
    // the network's own fixed order, and a row NEVER moves because it accepts the referral (spec
    // D10: an ordering that looked like a recommendation would be one). `referralCandidates`'
    // order preservation is well tested as a pure function; what this component RENDERS was not.
    // A row count alone survives sorting every accepting unit to the top, because the count, the
    // test ids, the reason strings and the uniqueness check are all unchanged by a reorder. This
    // one assertion pins order, completeness and non-truncation together, and subsumes the row
    // count it replaces.
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      allUnits().map((unit) => `ward-referral-match-row-${unit.id}`),
    );
    expect(within(list).queryAllByRole("button")).toHaveLength(0);
  });

  /**
   * I1 (fix round C, F4) — SECOND HALF, and the half that actually bites. The review proposed
   * this assertion on the RF-001 test alone. It was run against the mutation the review itself
   * names (sorting every accepting unit to the top of `referral-match.tsx`'s list) and the whole
   * suite stayed GREEN: RF-001 has ZERO accepting units, so an accepting-first sort is a no-op
   * there and the RF-001 assertion cannot see it. RF-005 has four accepting units, so the same
   * mutation genuinely reorders this list.
   *
   * The RF-001 assertion is kept — it still pins completeness and non-truncation for the
   * zero-accepting case — but this is the one that guards spec D10's headline property: a row
   * NEVER moves because it accepts the referral, because that ordering would read as a
   * recommendation.
   */
  it("RF-005's match view renders every unit in the network's own fixed order, accepting units NOT floated to the top", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const list = screen.getByTestId("ward-referral-match-list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      allUnits().map((unit) => `ward-referral-match-row-${unit.id}`),
    );
    // The guard is only meaningful if some unit DOES accept — otherwise an accepting-first sort
    // is a no-op and this test proves nothing, which is exactly how the RF-001 version failed.
    expect(within(list).getAllByRole("button", { name: /^Accept at/ }).length).toBeGreaterThan(1);
  });

  it("accepting an eligible unit for RF-005 moves it from queued to recently decided", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    const list = screen.getByTestId("ward-referral-match-list");
    const acceptButtons = within(list).getAllByRole("button", { name: /^Accept at/ });
    // I2 (fix round C, F5): RF-005 has FOUR accepting units, so `/^Accepted at /` alone matched
    // whichever ward the system happened to record. Making `handleAccept` ignore its `unitId`
    // argument and dispatch a different accepting unit kept the old assertion green while the
    // coordinator pressed "Accept at RPH Older Adult" and the record said Bentley. The clicked
    // button's own label is captured here so the decided text has to name THAT unit.
    expect(acceptButtons.length).toBeGreaterThan(1);
    const clickedUnitName = acceptButtons[0].textContent?.replace(/^Accept at /, "") ?? "";
    expect(clickedUnitName).not.toBe("");
    fireEvent.click(acceptButtons[0]);

    expect(screen.queryByTestId("ward-referral-board-select-RF-005")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-decided-row-RF-005")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decided")).toHaveTextContent(`Accepted at ${clickedUnitName}.`);
  });

  it("declining a queued referral moves it to recently decided with the chosen reason", () => {
    renderBoard();
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));

    fireEvent.change(screen.getByTestId("ward-referral-match-decline-reason"), {
      target: { value: "out_of_catchment" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-match-decline"));

    expect(screen.queryByTestId("ward-referral-board-select-RF-005")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-board-decided-row-RF-005")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decided")).toHaveTextContent(/^Declined — Out of catchment\.$/);
  });
});

/** A referral this suite constructs itself, so the structural-gap and rejection-surfacing tests
 *  below can control `units` directly rather than depending on the real fixture happening to
 *  contain the right shape of gap. */
const SYNTHETIC_YOUTH_REFERRAL: Referral = {
  id: "RF-TEST-STRUCTURAL",
  ageBand: "Youth",
  sex: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  homeRegion: "Perth Metropolitan",
  source: "community",
  raisedAt: NOW_ANCHOR - 10,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  state: "queued",
};

/** `ReferralMatchView` takes `units`/`referral` as explicit props (never reading them from
 *  context itself, the same reason `ShortlistPanel` takes `units` as a prop) — this harness is
 *  what lets a test hand it a deliberately different `units` array from the provider's own live
 *  state, either to construct a structural gap the real fixture does not contain, or (in the
 *  rejection-surfacing suite below) to prove the reducer validates independently of what this
 *  component's own props believe. */
function MatchHarness({ referral, units }: { referral: Referral; units: Unit[] }) {
  const { now, dispatch, rejections } = useWardFlow();
  return <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />;
}

function renderMatch(referral: Referral, units: Unit[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MatchHarness referral={referral} units={units} />
    </WardFlowProvider>,
  );
}

describe("ReferralMatchView — structural vs operational gap", () => {
  it("an age band with no unit anywhere in the network reads as a structural fact, never 'no bed available'", () => {
    const unitsWithoutYouth = allUnits().filter((unit) => unit.cohort !== "Youth");
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, unitsWithoutYouth);

    const banner = screen.getByTestId("ward-referral-match-structural-gap");
    expect(banner).toHaveTextContent("No youth unit exists in this network.");
    expect(banner).not.toHaveTextContent(/no bed available/i);
    expect(screen.queryByTestId("ward-referral-match-no-bed")).not.toBeInTheDocument();
    // I3 (fix round C, F6): the accepting-count paragraph used to render unconditionally, so this
    // screen read "No youth unit exists in this network." followed by "0 of 22 units accept this
    // referral right now." — and "right now" asserts that this may be different later, when there
    // is no youth bed anywhere to free up. That is the structural/operational distinction the
    // banner above exists to make, undone one line beneath it.
    expect(screen.queryByTestId("ward-referral-match-accepting-count")).not.toBeInTheDocument();
  });

  it("the same age band against the real, unmodified network shows no structural gap", () => {
    renderMatch(SYNTHETIC_YOUTH_REFERRAL, allUnits());
    expect(screen.queryByTestId("ward-referral-match-structural-gap")).not.toBeInTheDocument();
  });
});

/** Raises a fresh, real referral (via `RECEIVE_REFERRAL`, so it genuinely resolves inside the
 *  live reducer's `state.referrals`) and reviews it against a DECEIVED copy of `units` — every
 *  unit as this harness's own props see it, except the network's one forensic bed
 *  (`brm-adult-secure`), which this harness lies about (`forensic: false`) so the component's own
 *  rendering believes it is eligible and shows an Accept button for it. The live provider's real
 *  internal unit list is untouched, so `ACCEPT_REFERRAL`'s own `referralEligibility` check (inside
 *  the reducer) still sees the real forensic bed and refuses — proving the reducer validates
 *  independently of what the UI believes, the same property `referral-intake.tsx`'s own rejection
 *  test proves for `RECEIVE_REFERRAL`. */
function RaiseAndReviewForensicHarness() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const created = referrals.find((referral) => referral.id === "RF-901");
  return (
    <div>
      <button
        type="button"
        data-testid="raise-forensic-test-referral"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            sex: "Male",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            homeRegion: "Kimberley",
            source: "police",
            urgency: 2,
            originSiteCode: "BRM",
            transportNeeded: false,
          })
        }
      >
        Raise
      </button>
      {created ? (
        <ReferralMatchView
          referral={created}
          units={units.map((unit) => (unit.id === "brm-adult-secure" ? { ...unit, forensic: false } : unit))}
          now={now}
          dispatch={dispatch}
          rejections={rejections}
        />
      ) : null}
    </div>
  );
}

describe("ReferralMatchView — reducer refusal surfaces visibly, never swallowed", () => {
  it("an acceptance the reducer refuses (forensic bed) surfaces as a visible Rejection naming the failing gate", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaiseAndReviewForensicHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("raise-forensic-test-referral"));

    fireEvent.click(screen.getByTestId("ward-referral-match-accept-brm-adult-secure"));

    const rejection = screen.getByTestId("ward-referral-match-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/forensic/i);
    // A refused acceptance never silently succeeds — the referral still reads as queued.
    expect(screen.getByTestId("ward-referral-match-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-match-decided")).not.toBeInTheDocument();
  });
});
