import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectCaption, expectNeverSaysAgain, expectSays } from "./helpers/ward-caption";

const OF_GAP = "the constant-gap note";
const OF_READY = "the bed-readiness timing refusal";
const OF_JOIN = "the referral-join refusal";
const OF_PREP = "the preparing-count note";
const OF_OFFER = "the not-offered refusal";
const OF_SOFAR = 'the "so far" heading note';
const OF_ESC = "the escalated-movements disclosure";
const OF_REASON = "the declines-by-reason note";
const OF_CLEAN = "the nought-preparing count";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { STATISTICS_SECTIONS } from "@/components/ward-management/statistics/statistics-sections";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { DECLINE_REASONS, PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import type { BedRelease, Movement, Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COORDINATOR STATISTICS SCREEN, ON THE SCREEN.
 *
 * ⚠️ **WHAT ONLY A RENDERED PAGE CAN PROVE, and therefore what this file is for.**
 * `tests/ward-statistics-derivations.test.ts` already proves the arithmetic. Three things survive
 * correct arithmetic and can still make this page lie, and each has its own test below:
 *
 *   1. **A count of nought rendering as though the measurement were unavailable.** "No bed is being
 *      prepared" and "bed preparation cannot be timed" are completely different statements. The
 *      test asserts the numeral is present in the count element AND that the count element is not
 *      the absence element — a page that collapsed both to a dash would pass a prose assertion and
 *      fail this one.
 *   2. **The two audiences merged into one undifferentiated list.** The owner named them
 *      separately. The test asserts two distinct sections exist, that each says whose question it
 *      answers, and that a figure belonging to one is NOT inside the other.
 *   3. **An empty state that says only that data is absent.** The test asserts each absence names
 *      the mechanism — the field, what the record actually holds, and where a fix would have to be
 *      made — rather than merely reading "not yet collected".
 *
 * ⚠️ **EVERY EXPECTED FIGURE IS A LITERAL.** The fixtures below are built from instants chosen so
 * the answer is obvious by inspection (`0` to `120` is two hours), and the assertion types out the
 * rendered string. Nothing here recomputes an expectation with the screen's own derivation, which
 * is the specific defect that made an earlier test in this project unable to fail.
 */

/** Collapses the whitespace JSX introduces at line breaks, so a sentence can be pinned whole. */
function normalise(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

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
    pulledAt: null,
    arrivedAt: null,
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

function bedRelease(overrides: Partial<BedRelease>): BedRelease {
  return {
    id: "BR-TEST-01",
    unitId: "unit-under-test",
    state: "expected",
    expectedAt: 0,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: 0,
    confirmedBy: "Ward manager",
    ...overrides,
  };
}

/** Renders inside the provider with a pinned clock, exactly as every sibling dom suite does. The
 *  overrides are passed to the SCREEN, never to the provider: that is the seam the route is
 *  forbidden to use and a test is built on. */
function renderScreen(props: {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen {...props} />
    </WardFlowProvider>,
  );
}

describe("the statistics screen — two audiences, kept apart", () => {
  it("renders two named sections and says whose question each answers", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const system = screen.getByTestId("ward-statistics-system");
    const patients = screen.getByTestId("ward-statistics-patients");

    expect(within(system).getByRole("heading", { name: "How the system is performing" })).toBeTruthy();
    expect(within(patients).getByRole("heading", { name: "What is happening to patients" })).toBeTruthy();

    expect(screen.getByTestId("ward-statistics-system-audience").textContent).toContain("policy maker");
    expect(screen.getByTestId("ward-statistics-patients-audience").textContent).toContain("clinician");
  });

  /**
   * ⚠️ **EVERY FIGURE IS PLACEMENT-ASSERTED, not just two of them.** An adversarial check moved
   * `ward-statistics-referral-to-bed` wholesale into the system section and nothing failed, because
   * only pull-to-arrival and bed-readiness carried placement assertions. Two-audience separation is
   * the brief's own falsifier, so a figure with no placement assertion is a hole in the falsifier.
   * The table below is exhaustive over the four figures on the page and the loop asserts BOTH
   * directions for each — present in its own section, absent from the other.
   */
  it("puts every figure in its own audience's section, and in no other", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const PLACEMENT: { figure: string; belongsIn: string; notIn: string }[] = [
      { figure: "ward-statistics-bed-readiness", belongsIn: "system", notIn: "patients" },
      { figure: "ward-statistics-not-offered", belongsIn: "system", notIn: "patients" },
      { figure: "ward-statistics-refused-so-far", belongsIn: "system", notIn: "patients" },
      { figure: "ward-statistics-declines", belongsIn: "system", notIn: "patients" },
      { figure: "ward-statistics-declines-by-reason", belongsIn: "system", notIn: "patients" },
      { figure: "ward-statistics-blocked-discharges-by-reason", belongsIn: "system", notIn: "patients" },
      { figure: "ward-statistics-pull-to-arrival", belongsIn: "patients", notIn: "system" },
      { figure: "ward-statistics-referral-to-bed", belongsIn: "patients", notIn: "system" },
    ];

    // The vacuity guard: a table that had shrunk to nothing would make the loop assert nothing at
    // all, which is exactly how the referral-to-bed hole came to exist in the first place.
    expect(PLACEMENT.length).toBe(8);

    /*
     * ⚠️ **AND THE TABLE IS COMPARED AGAINST THE PAGE, NOT ONLY WALKED.** A hand-written length is
     * a second copy of "how many figures there are", and it stops being true the moment somebody
     * adds a figure without a placement row — the exact hole this test was written for, reopened
     * from the other side. Every `<article className={figure}>` on the page carries a testid
     * starting `ward-statistics-`, so the set of figures is discoverable from the DOM: a figure
     * added and not listed above fails HERE, naming itself, rather than passing unnoticed.
     */
    const rendered = Array.from(document.querySelectorAll("[data-testid^='ward-statistics-']"))
      .filter((node) => node.tagName === "ARTICLE")
      .map((node) => node.getAttribute("data-testid"));
    expect(rendered.length).toBeGreaterThan(0);
    expect([...rendered].sort()).toEqual([...PLACEMENT.map((entry) => entry.figure)].sort());

    for (const { figure, belongsIn, notIn } of PLACEMENT) {
      const home = screen.getByTestId(`ward-statistics-${belongsIn}`);
      const other = screen.getByTestId(`ward-statistics-${notIn}`);
      expect(within(home).queryByTestId(figure)).not.toBeNull();
      expect(within(other).queryByTestId(figure)).toBeNull();
    }
  });

  /**
   * ⚠️ **THE WHOLE SENTENCE, NOT ITS ALARMING HALF — AND THE FOLD OF 2026-09-01 IS WHY.** This
   * assertion read `toContain("coordinator")`, `toContain("nothing in this prototype enforces
   * that")` and `toContain("no role check")`, all three of which survive an edit that deletes the
   * clause saying WHAT a reader who reaches the page can then see. That clause is the one the fold
   * had to change: the home page said "and read every figure on it", the section frame said only
   * "can reach this page", and neither was true of both kinds of page. The folded wording is "and
   * read everything on it" — broader than the first, and it restores to the section pages the point
   * the second had dropped. `statistics-disclaimers.tsx` carries the reasoning; the identical string
   * is pinned in `tests/ward-statistics-sections.dom.test.tsx`, so a shared edit fails on both sides
   * and a page-specific one fails on this side alone.
   */
  it("says it is the coordinator's view and that nothing enforces it", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    expect(normalise(screen.getByTestId("ward-statistics-access").textContent)).toBe(
      "This is meant to be the coordinator's view — and nothing in this prototype enforces that. There is no " +
        "role check on this route. Anyone who can reach the Ward Flow mockups can reach this page and read " +
        "everything on it. Treat the coordinator framing as a statement of intent, not as access control.",
    );
  });

  /**
   * The banner nothing asserted until 2026-09-01, and the sentence that must survive every layout
   * change: below 40rem it was sitting under the rail's fixed phone bar. jsdom cannot see that —
   * the CSS reserve is the fix and it is untestable here — but the banner's PRESENCE and its words
   * are testable, so at least a deletion or a rewording cannot pass silently.
   *
   * ⚠️ **Pinned whole for the same reason as the access claim above.** `toContain("not real
   * figures")` guards the alarm and leaves unguarded the half that says which things are invented —
   * exactly the clause the fold rewrote.
   */
  it("says on itself that the figures are not real", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const banner = screen.getByTestId("ward-statistics-governance");
    expect(banner.textContent).toContain("Synthetic prototype");
    expect(normalise(banner.querySelector("p")?.textContent)).toBe(
      "These are not real figures. Every patient, bed, referral and instant this prototype holds is invented, and " +
        "nothing here has been measured against a real service.",
    );
  });
});

/**
 * THE HUB INDEX — the part of this page that is navigation rather than measurement.
 *
 * ⚠️ **THE ASSERTIONS BELOW ARE DRIVEN BY `STATISTICS_SECTIONS`, NEVER BY A LIST TYPED HERE.** A
 * hand-written expectation is a second copy of the section list, and a second copy is exactly what
 * the module exists to prevent: a section added to the module and forgotten on the page would agree
 * with a hand-written test and disagree with nothing. Comparing whole arrays rather than checking
 * membership per section is deliberate — an equality on the full sequence fails on a missing entry,
 * a duplicated entry, an entry out of order and an entry pointing at the wrong href, where a
 * per-section `toContain` would pass through the first three.
 */
describe("the hub index, driven by the section list", () => {
  /** Every entry the index rendered, in document order. */
  function renderedEntries(): HTMLAnchorElement[] {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });
    return Array.from(screen.getByTestId("ward-statistics-index").querySelectorAll("a"));
  }

  it("renders exactly one entry per section, in the module's order", () => {
    // The vacuity guard: an empty module would make every assertion below compare two empty arrays
    // and pass while the index rendered nothing at all.
    expect(STATISTICS_SECTIONS.length).toBeGreaterThan(0);

    const entries = renderedEntries();
    expect(entries.length).toBe(STATISTICS_SECTIONS.length);
    expect(entries.map((entry) => entry.getAttribute("data-testid"))).toEqual(
      STATISTICS_SECTIONS.map((section) => `ward-statistics-index-entry-${section.id}`),
    );
  });

  it("takes every label and description from the module rather than restating them", () => {
    // Each entry's own elements, compared as a pair: an entry that rendered the label twice, or
    // dropped the description, differs here where a check on the entry's whole text might not.
    const rendered = renderedEntries().map((entry) =>
      Array.from(entry.querySelectorAll("span")).map((part) => normalise(part.textContent)),
    );

    expect(rendered).toEqual(STATISTICS_SECTIONS.map((section) => [section.label, section.description]));
  });

  /**
   * ⚠️ **THE HREF IS COMPARED WHOLE, FRAGMENT INCLUDED.** One section has no page of its own and is
   * reached through the unit chooser on the comparisons page, which the module addresses with a
   * fragment. An assertion that compared only the path would bless an index that dropped it, and a
   * reader who clicked would land at the top of a page opening with two sections about why no
   * comparison exists, with the list they wanted below the fold. Fix round 1 found precisely that
   * defect in four other places.
   */
  it("renders each href exactly as the module gives it, fragment and all", () => {
    expect(renderedEntries().map((entry) => entry.getAttribute("href"))).toEqual(
      STATISTICS_SECTIONS.map((section) => section.href),
    );
  });

  /**
   * ⚠️ **NO NUMERAL ANYWHERE IN THE INDEX.** Not a section count, not a per-section item count, not
   * a badge. This page's safety property is that it withholds figures it cannot support and says
   * so; an index that counted itself would invite a reader to take every number further down the
   * page as measured. The check is over the whole index region rather than over the entries alone,
   * so a count added to the heading or the introduction fails here too.
   */
  it("puts no numeral anywhere in the index", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const index = screen.getByTestId("ward-statistics-index");
    // Not vacuous: an index that rendered nothing would also contain no numeral.
    expect(index.textContent?.length ?? 0).toBeGreaterThan(200);
    expect(index.textContent).not.toMatch(/[0-9]/);
  });

  /**
   * The index is navigation and the figures are the page; the ruling on this task was that no
   * figure moves off it. A figure rendered inside the index would be both a content migration and a
   * number in a place that must hold none.
   */
  it("keeps every figure out of the index and on the page where it already was", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const index = screen.getByTestId("ward-statistics-index");
    for (const figure of [
      "ward-statistics-bed-readiness",
      "ward-statistics-declines",
      "ward-statistics-pull-to-arrival",
      "ward-statistics-referral-to-bed",
    ]) {
      expect(within(index).queryByTestId(figure)).toBeNull();
      expect(screen.queryByTestId(figure)).not.toBeNull();
    }
  });
});

describe("the withheld statistic says so on the page", () => {
  /**
   * ⚠️ **THE ASYMMETRY THIS TEST EXISTS TO CLOSE.** `Movement.declines` is seeded non-empty, so a
   * coordinator who knows this prototype records declines and finds no decline figure cannot tell
   * "withheld pending a ruling" from "not recorded" from "nobody declined". A JSDoc block does not
   * reach that reader. The block must be on the page, in the SYSTEM section (it is a system
   * question), and it must name both records so the ruling is legible.
   */
  it("renders a withheld-declines block in the system section, naming both records", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const system = screen.getByTestId("ward-statistics-system");
    expect(within(system).queryByTestId("ward-statistics-declines")).not.toBeNull();

    // Concepts, not sentences: the owner is redesigning these pages, and pinning the wording made
    // a reworded caption and a DELETED one produce the same red. The deletion is the defect.
    expectCaption(screen.getByTestId("ward-statistics-declines-withheld"), {
      of: "the withheld declines figure",
      mentions: [
        ["withheld", "held back", "pending"],
        // Both records, because the ruling is a choice between them. Named by CONCEPT since the
        // field names came off these pages on 2026-09-06 (the owner's ruling); the identifiers are
        // still checkable, and the test below this one is what keeps them so.
        ["ReferralAddressing", "referral decline", "on the referral"],
        ["Movement.declines", "movement decline", "on the movement"],
        // The two readings the block must rule out. Stems rather than the phrases, so "declines are
        // not recorded" and "no decline is captured" both still satisfy it.
        "decline",
        ["record", "captur"],
      ],
    });
  });
});

describe("a count of nought is an answer, and never looks like a missing one", () => {
  it("renders nought beds being prepared as a numeral, in the count element", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [bedRelease({ id: "BR-A", preparing: false })],
    });

    const count = screen.getByTestId("ward-statistics-preparing-count");
    expect(count.textContent).toContain("0");
    // "cleaned", not "made ready", since the owner's 2026-09-04 one-word ruling fixed "Ready" to
    // the beds a coordinator can fill — close to the opposite of a bed under cleaning.
    expectSays(count.textContent ?? "", OF_CLEAN, ["cleaned", "being prepared"]);
    /*
     * ⚠️ AND IT MUST NOT SAY "EXPECTED". `expected` is a member of `BED_RELEASE_STATES` meaning the
     * discharge has NOT yet happened, so "0 expected beds are being made ready" told a coordinator
     * the bed was not yet available when it already is — preparation only ever begins after
     * `RELEASE_BED`. The count was right and the word inverted the capacity fact, which is why this
     * assertion is about a word rather than a number.
     */
    expect(count.textContent).not.toContain("expected");
    // The distinction made in the markup rather than only in the words: the measured count is its
    // own element and is NOT the element that says a figure cannot be measured.
    const absence = screen.getByTestId("ward-statistics-readiness-timing-absent");
    expect(count).not.toBe(absence);
    expect(absence.contains(count)).toBe(false);
  });

  it("renders a non-nought count in the same element, so nought is not a special rendering", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [bedRelease({ id: "BR-A", preparing: true }), bedRelease({ id: "BR-B", preparing: true })],
    });

    // Same testid, same wording shape, different numeral: a nought is not routed anywhere else.
    expect(screen.getByTestId("ward-statistics-preparing-count").textContent).toContain("2");
  });

  it("never puts a numeral inside an unmeasurable-figure statement", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [bedRelease({ id: "BR-A", preparing: false })],
    });

    // If a "cannot be measured" paragraph ever renders a figure, a reader has no way left to tell
    // an absence from a nought. All THREE absence statements are checked — including the withheld
    // declines block, whose whole safety is that saying it publishes no figure — and each must be
    // non-empty so this cannot pass against a page that renders none of them.
    const absences = [
      "ward-statistics-readiness-timing-absent",
      "ward-statistics-referral-join-absent",
      "ward-statistics-declines-withheld",
    ];
    expect(absences.length).toBe(3);

    for (const testId of absences) {
      const text = screen.getByTestId(testId).textContent ?? "";
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/[0-9]/);
    }
  });
});

describe("pull to arrival — a real figure, computed from the record", () => {
  it("renders the average of the two instants on the record", () => {
    renderScreen({
      admissions: [
        // 0 -> 120 is two hours; 0 -> 360 is six. The mean of 120 and 360 is 240 minutes, which is
        // four hours. Every one of those numbers is typed out rather than derived.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", pulledAt: 0, arrivedAt: 360 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("4h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-measured-count").textContent).toBe("2");

    // Asserted per END, not as two substrings anywhere in the sentence. An adversarial check
    // swapped shortest and longest and the old `toContain` pair passed both ways — and the seeded
    // world has no spread, so the swap would not have shown in the app either.
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("6h 00m");
  });

  /**
   * ⚠️ **THE EXCLUSION MUST BE VISIBLE OR IT IS NO BETTER THAN THE CLAMP IT REPLACES.** Ward Lead's
   * ruling: a clamp "does not make a bad number safe, it makes it invisible". Silently dropping an
   * incoherent record would be the same failure one step along — so the page counts it, and this
   * test proves the count reaches the screen rather than only the derivation.
   */
  it("excludes an impossible record from the average and shows it as excluded", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 240 }),
        // Arrived four hours before the bed was given away. A clamp would fold this in as a zero
        // and drag the average to 2h 00m.
        admission({ id: "AD-B", pulledAt: 500, arrivedAt: 260 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("4h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-measured-count").textContent).toBe("1");

    const incoherent = screen.getByTestId("ward-statistics-arrival-incoherent").textContent ?? "";
    expect(incoherent).toContain("1");
    expect(incoherent).toContain("EARLIER");
  });

  it("says there is nothing to average rather than showing nought minutes", () => {
    renderScreen({
      admissions: [admission({ id: "AD-A", state: "pulled", pulledAt: 30, arrivedAt: null })],
      referrals: [],
      bedReleases: [],
    });

    // An average of nothing is absent. A rendered "0m" here would claim everybody arrived the
    // instant their bed was given away, which is the most flattering possible lie on this page.
    expect(screen.queryByTestId("ward-statistics-arrival-average")).toBeNull();
    const nothing = screen.getByTestId("ward-statistics-arrival-nothing-to-average").textContent ?? "";
    expect(nothing).toContain("no average to show");
    // And it must not read as an impossibility — the measurement is available, the population is not.
    expect(nothing).toContain("can be measured");
  });

  it("counts the people still waiting separately instead of dropping them", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", state: "pulled", pulledAt: 0, arrivedAt: null }),
        admission({ id: "AD-C", state: "pulled", pulledAt: 15, arrivedAt: null }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The average is the single completed gap and nothing else...
    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("2h 00m");
    // ...and the two people still travelling are named on the page rather than silently excluded.
    expect(screen.getByTestId("ward-statistics-arrival-awaiting-count").textContent).toBe("2");
  });

  it("says how much of the figure is history rather than tonight", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-A", state: "departed", pulledAt: 0, arrivedAt: 120, leftAt: 9000 }),
        admission({ id: "AD-B", state: "occupied", pulledAt: 0, arrivedAt: 120 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    expect(screen.getByTestId("ward-statistics-arrival-ended-count").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-arrival-population").textContent).toContain("Historical");
  });
});

/**
 * ⚠️ **THE NEGATIVE HALF IS THE TEST.** The seeded world today has one identical gap on every
 * record, so an UNCONDITIONAL sentence would pass a presence assertion, pass the live-world
 * assertion, and be a lie the first time anybody gives the fixture real variety. A test that only
 * proves the sentence appears is therefore half a test: it cannot tell "conditional and currently
 * true" from "hardcoded and currently lucky". Both directions are asserted below, and the absence
 * case is the one that would go red on a hardcoded paragraph.
 */
describe("a constant gap names its cause, and only while it is constant", () => {
  it("names the seeded interval and where the fix belongs when the two ends meet", () => {
    renderScreen({
      admissions: [
        // Two records, the same gap on both: 0 -> 120 and 500 -> 620 are both two hours. That is
        // the shape a fixed offset between the two instants produces, and the shape this sentence
        // exists to explain.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", pulledAt: 500, arrivedAt: 620 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The world the sentence describes: an average with the two ends sitting on top of it.
    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("2h 00m");

    const text = screen.getByTestId("ward-statistics-arrival-constant-gap").textContent ?? "";
    // What the condition ACTUALLY entails, and the warning it earns: identical gaps, therefore no
    // variation, therefore not a measurement of the service.
    expectSays(text, OF_GAP, ["same length", "identical", "all the same"]);
    expectSays(text, OF_GAP, ["not a measurement", "never a measurement"]);
    // The mechanism, named rather than gestured at...
    expectSays(text, OF_GAP, ["offset"]);
    // ...but offered as an explanation rather than asserted as a finding, which is the half that
    // keeps this paragraph honest. The guard is an observed EQUALITY of two numbers; independently
    // generated gaps that happened to coincide would satisfy it identically, so the page cannot
    // know the offset is there. Asserting it from the symptom would be this page's own defect
    // class — a claim it cannot verify — moved out of a number and into a cause.
    expectSays(text, OF_GAP, ["coincide", "two ends"]);
    expectSays(text, OF_GAP, ["explanation"]);
    // And whose change would fix it — the property every other gap on this page already has.
    expectSays(text, OF_GAP, ["admissions"]);
    expectSays(text, OF_GAP, ["fixture"]);
    // It must never name the seeded value or the population size: both are seed facts that move,
    // and a sentence carrying them would age into a wrong figure on the page that is believed
    // hardest. Any digit at all in this paragraph is that defect.
    expect(text).not.toMatch(/[0-9]/);
  });

  it("says nothing of the kind once the gaps actually differ", () => {
    renderScreen({
      admissions: [
        // 0 -> 120 is two hours, 0 -> 360 is six. A real spread, so the sentence would be false.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", pulledAt: 0, arrivedAt: 360 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The figure still renders in full — this is not an empty state, and the ends now differ...
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("6h 00m");
    // ...so the constant-gap explanation must be gone from the page entirely, not merely reworded.
    expect(screen.queryByTestId("ward-statistics-arrival-constant-gap")).toBeNull();
  });

  /**
   * ⚠️ **ONE MEASURED ADMISSION MEETS THE EQUALITY AND MEANS NOTHING BY IT.** A single gap is its
   * own shortest and its own longest, so `shortestMinutes === longestMinutes` holds trivially —
   * and there is no constancy to report, because there is nothing for the one gap to agree with.
   * A paragraph saying every measured gap is the same length would be talking about agreement
   * across a population of one.
   *
   * This is why the guard is `measuredCount > 1` AND the equality rather than the equality alone,
   * and it is the case the two tests above cannot reach: both build two-record fixtures, so both
   * stay green against a guard that dropped the count entirely. The seeded world carries hundreds
   * and can never produce this, which is precisely the reason it needs a test — the screen is
   * generic, its callers are not, and nothing in the live world would ever show the mistake.
   */
  it("says nothing when a single admission makes the two ends meet trivially", () => {
    renderScreen({
      admissions: [
        // One record with both instants; 0 -> 120 is two hours. Its shortest and its longest are
        // necessarily the same number, and that fact carries no information at all.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        // A second admission that is NOT measured — no arrival yet — so it cannot rescue the
        // population size. Present so this fixture cannot pass by having only one record on the
        // page: the guard must count MEASURED gaps, not admissions.
        admission({ id: "AD-B", state: "pulled", pulledAt: 60, arrivedAt: null }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The figure renders, the population is one, and the ends do coincide...
    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-measured-count").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("2h 00m");
    // ...and the paragraph must still stay away, because coincidence of one value with itself is
    // not the constancy it describes.
    expect(screen.queryByTestId("ward-statistics-arrival-constant-gap")).toBeNull();
  });
});

/**
 * The one retired claim BOTH empty states must never make again: that the missing figure is merely
 * uncollected and will arrive once somebody types it in. Both paragraphs exist to rule that out —
 * neither figure is producible by data entry against today's model — so a wording that promises it
 * later is false on either page, and the two lists were duplicated as one exact string each.
 *
 * ⚠️ **EVERY SPELLING HERE WAS RUN AGAINST THE HONEST COPY ON BOTH PAGES, because widening a ban is
 * not free: a ban forbids more, so each addition is a new way to go red on correct work.** The
 * near miss is real — the readiness paragraph legitimately says bed readiness "is recorded as
 * BedRelease.preparing", so a ban on the bare stem "recorded" would fail on true copy. These are
 * phrases, and the phrase is what carries the promise.
 */
const DATA_ENTRY_FRAMINGS: readonly string[] = [
  "not yet collected",
  "not yet recorded",
  "not yet captured",
  "not yet gathered",
  "not yet entered",
  "has not been collected",
  "have not been collected",
  "yet to be collected",
  "awaiting collection",
  "once the data is collected",
  "when the data is collected",
];

/**
 * THE FIELD NAMES CAME OFF THE SCREEN AND MUST STAY REACHABLE FROM THE SOURCE.
 *
 * 🔴 **WARD LEAD'S RULING, 2026-09-06 — NOT the owner's, and an earlier version of this comment
 * said it was his.** He ruled that the two method write-ups stay unpublished; the field names were
 * my call, taken under the authority he had delegated. Thirty-six internal
 * identifiers were rendered to the clinician across the five statistics screens. They are gone from
 * every screen; the explanations that turned on them are not.
 *
 * ⚠️ **DELETING THE IDENTIFIER IS THE EASY GREEN AND IT IS THE WRONG ONE.** Each of these
 * paragraphs makes a claim about what a record can and cannot hold. A reader who wants to check one
 * needs the field name — that reader is a developer, and the source comment is where they look. An
 * identifier removed from BOTH places leaves a confident, unfalsifiable paragraph, which is worse
 * than the pill ever was.
 *
 * ⚠️ **SO THIS ASSERTS BOTH DIRECTIONS, AND THAT IS THE POINT.** Absent from the render (the
 * ruling) and present in the source (checkability). A one-directional version of this test is
 * satisfied by deleting the field name outright — which is exactly the shortcut it exists to catch —
 * and the other one-directional version is satisfied by putting the pills back.
 */
describe("the identifiers came off the screen and stayed in the source", () => {
  const SOURCE = join(process.cwd(), "src/components/ward-management/statistics/statistics-screen.tsx");

  // Every identifier this file's own assertions used to read off the rendered page. It is the list
  // that shrinks when somebody takes the easy green, so it is spelled out rather than derived.
  const identifiers = [
    "ReferralAddressing",
    "Movement.declines",
    "BedRelease.preparing",
    "BedRelease.confirmedAt",
    "Admission.referralId",
    "Unit.empty",
    "Unit.allocatable",
    "Admission.blockReason",
    "Movement.blocker",
  ] as const;

  it.each(identifiers)("%s is nowhere on the rendered page", (identifier) => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    expect(
      document.body.textContent ?? "",
      `${identifier} is being published to the clinician again. The owner ruled these off the ` +
        "prototype on 2026-09-06. Say which RECORD in plain English and keep the identifier in a source comment.",
    ).not.toContain(identifier);
  });

  it.each(identifiers)("%s is still named in the source, so the claim it supports stays checkable", (identifier) => {
    expect(
      readFileSync(SOURCE, "utf8"),
      `statistics-screen.tsx no longer names ${identifier} anywhere, so the paragraph that turns on ` +
        "it can no longer be checked by the one reader who would check it. Put it back in the comment " +
        "above that paragraph — the ruling was about the screen, not about the source.",
    ).toContain(identifier);
  });
});

describe("the two empty states say WHY, mechanically", () => {
  it("names the record and the reason bed readiness cannot be timed", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const text = screen.getByTestId("ward-statistics-readiness-timing-absent").textContent ?? "";
    expectSays(text, OF_READY, ["bed-release record", "BedRelease"]);
    // What readiness IS on that record — a flag, not an instant — which is the whole reason.
    expectSays(text, OF_READY, ["yes/no", "boolean", "true or false"]);
    // The point that stops somebody filling the gap with data entry: the two ends cannot coexist.
    // The mechanism rather than the second field name — one field shared by every act, so the act
    // that ends preparation overwrites the instant that began it.
    expectSays(text, OF_READY, ["shared provenance field", "the same one every other act"]);
    expectSays(text, OF_READY, ["never both", "destroyed by"]);
    expectSays(text, OF_READY, ["instants", "timestamps", "two ends"]);
    expect(text).toContain("change to the bed model");
    // The DATA-ENTRY framing is the retired falsehood: no amount of data entry against today's
    // model produces this figure, so any wording promising it later is wrong however it is spelt.
    expectNeverSaysAgain(text, "the bed-readiness refusal", DATA_ENTRY_FRAMINGS);
  });

  /**
   * ⚠️ **THE REGRESSION GUARD FOR A FALSE CLAIM THIS PAGE ALREADY SHIPPED.** Until 2026-09-01 the
   * paragraph said no instant marks the start of preparation. `SET_BED_PREPARATION` writes
   * `confirmedAt: event.now` on the same object it writes `preparing` to, so one is stamped every
   * time. The refusal is right and the reason was wrong, which is the combination every green test
   * in this suite missed — so the old wording is now forbidden by name rather than merely replaced.
   */
  it("never says again that nothing marks the moment preparation started", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const text = screen.getByTestId("ward-statistics-readiness-timing-absent").textContent ?? "";
    // Widened past the two exact sentences: a withdrawn claim returns just as wrongly when it is
    // paraphrased, and the original ban passes on any rewrite of it.
    expectNeverSaysAgain(text, "the readiness-timing refusal", [
      "nothing marks the moment preparation started",
      "nothing records when preparation started",
      "no instant marks the moment preparation",
      "no timed state to measure",
      "no timed state",
    ]);
    /*
     * 🔴 **A BARE BAN ON "not a missing timestamp" STOOD HERE UNTIL 2026-09-05 AND IT WAS A
     * FIGHTER — it went red on copy stating the very fact the paragraph exists to state.**
     *
     * It was never one of the five claims corrected in `ab16d11a9`; that commit lists them, and
     * only "nothing marks the moment preparation started" came from this paragraph. The phrase was
     * collateral in the same rewrite, and banning it froze one wording of a surviving true claim.
     *
     * **The live headline says the reason is "not that nobody writes a time down". "The reason is
     * not a missing timestamp" says the same thing — the obstacle is not an unfilled field — and
     * it is arguably the better sentence.** Measured rather than argued: substituting it into
     * `statistics-screen.tsx` failed THIS test ALONE, by name, with the other 47 in the file green,
     * including every assertion about `confirmedAt`, the boolean, the pair of instants and the
     * model change. Source hash 73a0700c before and after.
     *
     * That is Ward Lead's own test for a fighter — restate the fact differently and the guard must
     * SURVIVE — failed in one mutation. The retired FALSE claim is guarded above, by concept, which
     * is where the protection belongs. Do not reinstate this line.
     */
  });

  it("explains the refusal by what the join can establish, not by what the fixture holds", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const text = screen.getByTestId("ward-statistics-referral-join-absent").textContent ?? "";
    expectSays(text, OF_JOIN, ["admission carries the referral", "Admission.referralId"]);
    // The mechanism, and specifically NOT "the join resolves to nothing" — whether it does depends
    // on the data, and the paragraph must not depend on that either way.
    expectSays(text, OF_JOIN, ["matching id", "same id"]);
    expect(text).toContain("the two ends of one wait");
    expectSays(text, OF_JOIN, ["produced the bed", "created the bed"]);
    expect(text).toContain("dates the wrong event");
    expectSays(text, OF_JOIN, ["change to the data"]);
    expectNeverSaysAgain(text, "the referral-join refusal", DATA_ENTRY_FRAMINGS);
  });

  /**
   * ⚠️ **QUANTITIES ARE RENDERED, NEVER WRITTEN — and this is the assertion that keeps it that way.**
   * Every wrong version of this paragraph was wrong about a NUMBER it had typed out: how many pairs
   * matched, how they came to match, how far apart the two instants were. A figure in prose is a
   * claim about today's data that no test watches and no fixture edit corrects, and this page has
   * shipped that defect twice.
   *
   * The counts live in their own elements a few lines below, recomputed on every render. So the
   * prose carries no numeral at all — a rule a reviewer can check at a glance and a rewrite cannot
   * quietly weaken.
   */
  it("states the refusal without a single numeral in it", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const text = screen.getByTestId("ward-statistics-referral-join-absent").textContent ?? "";
    // Not vacuous: it has to be a real paragraph, not an empty element that trivially has no digit.
    expect(text.length).toBeGreaterThan(400);
    expect(text).not.toMatch(/[0-9]/);
    // And the measurement is still on the page, in its own elements, so the prose gave nothing up.
    expect(screen.getByTestId("ward-statistics-join-coherent-count").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-join-matched-count").textContent).toBe("0");
  });

  /**
   * ⚠️ **THE REGRESSION GUARD FOR THE PAGE'S WORST DEFECT, AND IT HAS ALREADY RECURRED.** This
   * bolded lede defended a correct refusal with a series of false statements about the data: that
   * the matching records were different people; that their ids collided by accident because the
   * front door had been numbered separately; that arrivals preceded referrals by weeks. Each was a
   * claim about seed data, each read as the most checkable sentence on a page whose reader cannot
   * check it, and every test in this file stayed green through all of them.
   *
   * Each wording is forbidden by name here, on the whole rendered page rather than in one
   * paragraph — the claims were duplicated between this screen and `statistics-derivations.ts`, so
   * a correction applied to one and not the other is exactly the half-landed fix this guards.
   */
  it("carries none of the retired claims anywhere on the page", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const page = screen.getByTestId("ward-statistics-screen").textContent ?? "";
    // Not vacuous: the page has to have rendered real prose for the absences below to mean
    // anything at all.
    expect(page.length).toBeGreaterThan(2000);
    /*
     * ⚠️ **SEVEN BARE BANS STOOD HERE AS LOOSE `not.toContain` / `not.toMatch` CALLS UNTIL
     * 2026-09-06, AND TWO OF THEM FORBADE ORDINARY ENGLISH ACROSS THE WHOLE PAGE.** `/by accident/i`
     * goes red on "this is not by accident"; `/weeks before/i` goes red on any honest date phrasing
     * anywhere on a statistics screen — and the scope here is the entire rendered page, which
     * multiplies the chance rather than reducing it. Neither had a named subject or a failure
     * message, so a future red would have arrived as a bare boolean beside a line number.
     *
     * **The page-wide SCOPE is deliberate and is kept**: these claims were duplicated between this
     * screen and `statistics-derivations.ts`, and a correction applied to one and not the other is
     * the exact half-landed fix this test exists for. Narrowing to an element would be the bug.
     *
     * So what changed is the PHRASES, not the reach. Each now carries enough of the retired
     * sentence to be the CLAIM rather than an English commonplace — "the two collide" instead of
     * the bare word, "weeks before anyone raised" instead of two words that mean nothing on their
     * own. A ban has to be defeatable only by dropping the claim, never by writing a normal
     * sentence that happens to share two words with it.
     */
    expectNeverSaysAgain(page, "the statistics page", [
      // The referral-join narrative, retired because it described the FIXTURE as though it were
      // the model. Each phrase carries the claim; none of them is a phrase honest copy would reach
      // for by accident — including this one.
      "not the same person",
      "the two collide",
      "where they collide",
      "matching pair is an accident",
      "match by accident",
      "numbered separately",
      "weeks before anyone raised",
      "weeks before the referral",
      // The two unearned claims that travelled with them: one mint site stated as though it were
      // the only one, and a fixture fact stated as a model fact.
      "its own ward tag",
      "the field is populated",
      // And the two model-level claims corrected in the same pass.
      "nothing marks the moment preparation started",
      "nothing records when preparation started",
      "These beds are already free",
      "these beds are free already",
      "the beds are already free",
    ]);
  });

  /**
   * ⚠️ **AN UNEARNED INVARIANT, STATED FLAT.** "These beds are already free" was true of today's
   * fixture and of today's only caller, and false as a claim about the model:
   * `SET_BED_PREPARATION` checks the acting ward and the note and never the release's stage. The
   * page now says both halves — what should hold, and that nothing enforces it.
   */
  it("says the preparing count should be already-free beds without claiming the model enforces it", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const text = screen.getByTestId("ward-statistics-bed-readiness").textContent ?? "";
    expect(text).toContain("should already be free");
    expectSays(text, OF_PREP, ["enforce"]);
    expectNeverSaysAgain(text, "the bed-readiness note", [
      "These beds are already free",
      "these beds are free already",
      "the beds are already free",
    ]);
  });

  it("shows the measured join beside the claim, so the claim is checkable", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-A", referralId: "RF-GER1-01", arrivedAt: 900 }),
        admission({ id: "AD-B", referralId: "RF-GER1-02", arrivedAt: 900 }),
      ],
      // No referral carries either id, so nothing matches and nothing can be measured.
      referrals: [],
      bedReleases: [],
    });

    // Equality on the figure's OWN element, never `toContain` on the sentence. An adversarial
    // check found the old containment assertion passed by luck: the substituted value was `267`,
    // which happens to contain no "0" — `260`, `100` or `30` would all have slipped through.
    expect(screen.getByTestId("ward-statistics-join-coherent-count").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-join-matched-count").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-join-with-id-count").textContent).toBe("2");
    expect(screen.getByTestId("ward-statistics-join-referrals-searched").textContent).toBe("0");

    // The population sentence is a separate element and was asserted by nothing; a deletion of it
    // would have left the coherent count with no denominator on the page and no test failing.
    const population = screen.getByTestId("ward-statistics-join-population").textContent ?? "";
    expect(population).toContain("2");
    expect(population).toContain("carrying a referral id");
  });
});

describe("the live world", () => {
  it("renders against provider state with no overrides at all", () => {
    // The route passes nothing, so this is the only rendering a user ever sees. A screen that only
    // worked against hand-built fixtures would pass every test above and be blank in the app.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-statistics-screen")).toBeTruthy();
    // The seeded world has measurable arrivals, so the average branch — not the empty one — renders.
    expect(screen.queryByTestId("ward-statistics-arrival-nothing-to-average")).toBeNull();
    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("5h 00m");

    /*
     * ⚠️ AND THE SEEDED WORLD IS THE CONSTANT-GAP WORLD, which is the whole reason the sentence
     * had to be written. The seed derives one instant from the other by a single offset at every
     * site that writes both, so the two ends land on the headline and the average re-reports one
     * seeded interval. Asserted from the seed rather than a hand-built fixture: a reader of the
     * app sees only this rendering, and a sentence that appeared for test fixtures and not for the
     * live page would leave the real reader with the symptom and no cause, exactly as before.
     */
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("5h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("5h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-constant-gap")).toBeTruthy();

    /*
     * ⚠️ THE LIVE-WORLD ENDED COUNT, pinned to a non-zero literal, and it is the guard for the
     * in-flight `"left"` -> `"departed"` rename. Every other test of this figure uses a hand-built
     * two-record fixture whose `state: "departed"` literal still hits a stale `case "left"`, so a
     * half-landed rename left them all green while the page silently rendered "0 of the measured
     * admissions have since ended" — inverting the caveat that stops a historical figure being
     * read as tonight's ward. Only a seed-driven assertion sees that.
     */
    const endedCount = screen.getByTestId("ward-statistics-arrival-ended-count").textContent ?? "";
    expect(Number(endedCount)).toBeGreaterThan(0);
    expect(endedCount).toBe("5");

    /*
     * ⚠️ COUPLED TO TWO THINGS THAT DO NOT MENTION IT — READ BOTH BEFORE CHANGING THESE FIGURES.
     *
     *   1. `tests/ward-statistics-derivations.test.ts`, "finds exactly one seeded pair, and that
     *      pair can carry a duration" — the same measurement asserted on `referralToBedJoin`
     *      itself rather than on the rendered page. It moves whenever this does, in its own file.
     *   2. The community hub. `admissionBelongsToTeam`
     *      (`src/components/ward-management/community/community-derivations.ts`) runs the same
     *      `find` over the same two arrays, so the one seeded admission that makes these counts
     *      non-nought is also the only thing that can put anybody on one of the 65 team pages.
     *
     * Full account: `docs/ward-flow/fields-with-no-producer-2026-09-01.md` (final addendum).
     *
     * ⚠️ THE SEEDED JOIN MATCHED NINE UNTIL 2026-09-01, AND THIS COMMENT WAS WRONG ABOUT THEM TWICE
     * OVER. It said the nine were an ACCIDENTAL COLLISION between the admissions fixture's ward
     * tags and referrals that happened to share hospital abbreviations, and that the patients
     * arrived WEEKS BEFORE the referral. Neither survives being checked. `52ad01dda` added those
     * nine DELIBERATELY — in its own words, "by using the ids the admissions ALREADY hold, so not
     * one admission changed" — to make the community team pages render; `git log -S'RF-SCGO-15'`
     * returns it, and `fa616d1c9` is where they were removed again, for a third reason: they asked
     * for no ward bed and sat at the top of the coordinator's bed-matching queue. And three of the
     * nine were 1.03, 3.03 and 5.04 days, not weeks. ⚠️ The one-day case is the dangerous one,
     * because it reads as a rounding error rather than as a category error.
     *
     * ⚠️ BOTH HALVES ARE TRUE AND NEITHER ALONE IS THE STORY: the nine were deliberate, and the
     * pairs they produced were meaningless. Every one put the patient in the bed before the
     * referral existed, so not one could carry a duration.
     *
     * ⚠️ THE COUNT IS ONE NOW, AND THAT IS THE FRONT DOOR STARTING TO WORK RATHER THAN THE
     * COLLISION RETURNING. `AD-LEFT-01` names `RF-010`, the community-only referral split out of
     * `RF-007`; the referral is raised 24 days before the anchor and the admission arrived 23 days
     * ago, so MATCHED and COHERENT are both one. The equality is the check that matters — a matched
     * count running ahead of the coherent one is the `52ad01dda` shape returning under a new name.
     *
     * ⚠️ **TEN SINCE 2026-09-05, AND THE NINE ADDED ARE DEMONSTRATION DATA — see
     * `MIDLAND_DEMONSTRATION_ROWS` (`ward-movements.ts`).** The owner asked for one community
     * team's page to be populated so the redesign could be judged on a screen with people on it,
     * and nine referrals naming `"Midland"` were added using ids the admissions seed ALREADY
     * manufactures. **Not one admission changed.**
     *
     * ⚠️ **THE TWO FIGURES BELOW MOVED TOGETHER, WHICH IS THE WHOLE TEST.** Every one of the nine
     * is raised, and answered, before its admission's bed was pulled — so each match can date a
     * bed, and MATCHED still equals COHERENT. **A ten that is not matched by a ten below is the
     * `52ad01dda` shape returning**, and the fix is the fixture's timing, never this number.
     */
    expect(Number(screen.getByTestId("ward-statistics-join-with-id-count").textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId("ward-statistics-join-referrals-searched").textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-statistics-join-matched-count").textContent).toBe("10");
    expect(screen.getByTestId("ward-statistics-join-coherent-count").textContent).toBe("10");
  });
});

/**
 * A fully-populated movement for the screen, typed as `Movement` so a field added to the record
 * fails to compile here rather than leaving this helper building a stale shape.
 */
function movement(overrides: Partial<Movement>): Movement {
  return {
    id: "WF-TEST-01",
    originEdId: "ed-under-test",
    openedAt: 0,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

/**
 * FIGURE 2 — THE ONE THE PAGE MUST NOT APPROXIMATE.
 *
 * ⚠️ **THE ASSERTION THAT MATTERS HERE IS AN ABSENCE OF A NUMERAL, NOT THE PRESENCE OF A
 * PARAGRAPH.** The owner called this the most politically sensitive figure in the set. The failure
 * mode is not a missing explanation — it is a plausible number appearing under the heading and
 * being quoted as the thing it is not, with the disclaimer beneath it dropped on the way out. So
 * these tests check the block for what it must NOT contain as well as for what it says.
 */
describe("empty beds that were not offered — an absence, with no proxy beside it", () => {
  it("renders the absence and no figure at all", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const block = screen.getByTestId("ward-statistics-not-offered");
    expect(within(block).getByRole("heading", { name: "Empty beds that were not offered" })).toBeTruthy();
    expect(within(block).getByTestId("ward-statistics-not-offered-absent")).toBeTruthy();

    // ⚠️ NOT A PROSE ASSERTION. A figure beside its own disclaimer is read as the figure, so what
    // is pinned is that the block renders no digit anywhere — no derived held count, no arithmetic,
    // no "0". A stand-in added later fails here whatever wording is put around it.
    expect(normalise(block.textContent)).not.toMatch(/[0-9]/);
  });

  /**
   * The mechanism, on the page. This page's standing rule is that an absence names the field, says
   * what the record actually holds, and says whose change would fix it — "not yet collected" would
   * invite somebody to fill the gap later with a plausible number.
   */
  it("names both capacity measures, says what the model does hold, and says whose change would fix it", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const absence = normalise(screen.getByTestId("ward-statistics-not-offered-absent").textContent);

    expectSays(absence, OF_OFFER, ["physically empty", "Unit.empty"]);
    expectSays(absence, OF_OFFER, ["can actually allocate", "Unit.allocatable"]);
    // What the nearest derived signal actually measures — a ward-side readiness gap over every bed
    // the ward has, never a record of an offer to a particular request.
    expectSays(absence, OF_OFFER, ["aggregate", "whole ward"]);
    expect(absence).toContain("ward-side readiness gap");
    // And where the fix lives. Without this the reader is left thinking better data entry would do.
    expectSays(absence, OF_OFFER, ["per bed", "per offer"]);
    expectSays(absence, OF_OFFER, ["bed model"]);
  });
});

/**
 * FIGURE 1 — AND EVERY SPELLING OF IT CARRIES "SO FAR".
 *
 * ⚠️ **THE SECOND-SPELLING TEST IS THE ONE THAT EARNS ITS PLACE.** A title that qualifies the claim
 * beside a summary line, a note or a testid that does not reintroduces the whole defect at exactly
 * the point most likely to be quoted, and no other check in this repository looks at prose for the
 * unqualified phrasing.
 */
describe("referrals where every ward asked so far has refused", () => {
  it("counts a movement with a refusal on record and nothing pending, and says how many were examined", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({ id: "WF-A", referredUnitIds: [], declines: [{ unitId: "unit-1", at: 0, reason: "no_bed" }] }),
        movement({ id: "WF-B", referredUnitIds: ["unit-2"], declines: [] }),
      ],
    });

    // One of two, both literals chosen so the answer is obvious by inspection.
    expect(screen.getByTestId("ward-statistics-refused-so-far-value").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-refused-so-far-open-count").textContent).toBe("2");
  });

  /**
   * ⚠️ **A COUNT OF NOUGHT RENDERS AS A NOUGHT.** "No movement is in this state" and "this cannot
   * be counted" are different statements, and this page never blurs them: the count element is
   * present with its numeral, and it is not the absence element.
   */
  it("renders a real nought rather than falling back to an absence", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    expect(screen.getByTestId("ward-statistics-refused-so-far-value").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-refused-so-far-open-count").textContent).toBe("0");
  });

  it("says every ward asked SO FAR, in the heading and in the testid, and never says it without the qualifier", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const block = screen.getByTestId("ward-statistics-refused-so-far");
    expect(
      within(block).getByRole("heading", { name: "Referrals where every ward asked so far has refused" }),
    ).toBeTruthy();

    /*
     * ⚠️ **THE UNQUALIFIED PHRASING MUST APPEAR NOWHERE ON THE PAGE.** Scanned over the WHOLE
     * document rather than this block, because the place it would do the most damage is a summary
     * line or a section heading somewhere else — and a check scoped to the block would miss exactly
     * that. Every "every ward … refused" construction must carry "so far" between the two.
     */
    const page = normalise(document.body.textContent);
    const unqualified = /every ward (?!asked so far)[a-z ]*(refused|said no|declined|would|turned)/i;
    expect(page).not.toMatch(unqualified);

    /*
     * ⚠️ **"NOBODY WOULD TAKE" IS ALLOWED ON THE PAGE ONLY AS A DENIAL, and that is a deliberate
     * narrowing rather than a loophole.** Naming what the figure is NOT is the sharpest thing the
     * note does — a reader who has been told the number is not a count of patients nobody would
     * take will not repeat it as one. What must never exist is the phrase standing as a claim, so
     * this asserts every occurrence is inside the denial, and separately that no HEADING carries
     * it: a heading is what gets screenshotted and quoted, and a caveat in body text does not
     * travel with it.
     */
    const denial = "It is not a count of patients nobody would take";
    expect(page).toContain(denial);
    expect(page.split(/nobody would take/i).length - 1).toBe(page.split(denial).length - 1);

    for (const heading of screen.getAllByRole("heading")) {
      expect(normalise(heading.textContent)).not.toMatch(/nobody would take/i);
      expect(normalise(heading.textContent)).not.toMatch(unqualified);
    }
  });

  /**
   * ⚠️ **THE NOTE HAS TO READ AS A REASON, NOT A HEDGE.** A reader who understands WHY the
   * qualifier is there keeps it when they repeat the number; one who thinks it is caution drops it.
   * So the note must name the three mechanical facts, not merely warn.
   */
  it("explains why the heading says so far, mechanically", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const why = normalise(screen.getByTestId("ward-statistics-refused-so-far-why-so-far").textContent);

    // 1. Exhaustion is not a state the record can express.
    expect(why).toContain("no closure flag");
    expect(why).toContain("cap-reached marker");
    // 2. A decline is not terminal — the movement can be referred onward immediately.
    expectSays(why, OF_SOFAR, ["decline lands", "a decline arrives"]);
    // 3. The cap is what makes the gap material rather than pedantic, and it is RENDERED from the
    //    model rather than typed into the sentence, so the numeral cannot go stale.
    expect(screen.getByTestId("ward-statistics-refused-so-far-cap").textContent).toBe(String(PARALLEL_REFERRAL_CAP));
    /*
     * 🔴 **THIS ASSERTION USED TO PIN A FALSE SENTENCE, AND THAT IS WHY THE DEFECT SURVIVED.** It
     * required the note to contain "the rest have never been asked" — so the note said it, the test
     * went green, and a guard stood over the error rather than catching it.
     *
     * The claim was invalid. `REFER_TO_UNITS` rejects only `event.unitIds.length >
     * PARALLEL_REFERRAL_CAP` — a per-CALL check on the array passed in, with no test of
     * `referredUnitIds` and no lifetime total — and `REFERRABLE_MOVEMENT_STAGES` includes
     * `destination_review`, which is exactly where a movement sits after its wards decline. So a
     * movement declined by three wards may be put to three more, repeatedly. **A patient refused by
     * six wards was described to a clinician as having been put to three, with the other three
     * counted among wards that had "never been asked" — on the screen built to show how hard
     * someone is to place.**
     *
     * ⚠️ The paragraph already carried its own refutation two sentences earlier ("a coordinator can
     * put it to fresh wards the moment a decline lands"), asserted by the guard above. Both
     * assertions passed together for as long as the contradiction existed.
     *
     * Pinned now as a PROPERTY rather than a phrase: the note must not tell a reader that the
     * unasked wards are knowable, however it words that. Wording may change; this may not.
     */
    expectNeverSaysAgain(why, "the refused-so-far note", [
      "never been asked",
      "have not been asked",
      "yet to be asked",
    ]);

    /*
     * 🔴 **A BARE `not.toContain("at most")` STOOD HERE UNTIL 2026-09-06 AND IT BANNED A TRUE
     * SENTENCE.** The cap is a CONCURRENCY limit — the live copy says a movement can be live at
     * three wards *at once* — so **"live at at most three wards at once" is correct English and
     * correct fact, and the old ban forbade it.** The falsehood was never the phrase "at most"; it
     * was attaching a maximum to how many wards a movement has been ASKED over its life, which the
     * record cannot measure at all.
     *
     * ⚠️ **A ban on two common English words cannot tell those apart, and this project has now
     * shipped that mistake twice** — the other was a ban on "not a missing timestamp" that went red
     * on the sentence its own paragraph existed to state. Both were phrases standing in for a
     * property, and both would have fired on the owner's next redesign.
     *
     * So the property is asserted where it actually lives: **wherever this note states a maximum, it
     * must say in the same sentence that the maximum is about wards deciding TOGETHER.** A sentence
     * capping what has been asked, with no concurrency qualifier, is the defect — however it is
     * worded, and whether or not it uses the words "at most".
     */
    const CAPS = ["at most", "no more than", "a maximum of", "up to"];
    const CONCURRENT = ["at once", "at the same time", "simultaneously", "concurrently", "together"];
    const uncapped = why
      .split(/(?<=[.;])\s+/u)
      .filter((sentence) => CAPS.some((cap) => sentence.toLowerCase().includes(cap)))
      .filter((sentence) => !CONCURRENT.some((word) => sentence.toLowerCase().includes(word)));
    expect(
      uncapped,
      "this sentence states a maximum without saying it is a limit on wards deciding TOGETHER, so it " +
        "reads as a cap on how many wards a movement has been put to over its life — a number nothing " +
        "on the record measures. Say what the cap is a cap ON; do not delete the word.",
    ).toEqual([]);

    // The positive half, as a concept. It was pinned as the exact eight-word phrase "not on how many
    // have been asked" until 2026-09-06, which is the same fighter one clause further on: a faithful
    // rewrite of a true sentence would have gone red.
    expectSays(why, "the not-a-lifetime-total clause", ["how many have been asked", "how many wards", "over its life"]);
    // And it must say what the number IS, not only what it is not.
    expectSays(why, "the what-this-number-is clause", ["worklist", "needs a decision"]);

    /*
     * ⚠️ **THE CAP IS A CEILING AND THE NOTE MAY NOT PROMOTE IT TO A TYPICAL FIGURE.** Until
     * 2026-09-01 this sentence said "MOST of what is counted here has been put to that many out of
     * the whole network". Nothing measures that. The counted population is whatever
     * `handoverSnapshot` classifies as declined-by-all — an empty `referredUnitIds` beside a
     * non-empty `declines` — which a movement carrying a SINGLE decline satisfies exactly as one
     * that reached the cap does. Neither the derivation nor this page records how many wards a
     * counted movement was actually put to, so "most" was a claim about a distribution no line of
     * source can witness, sitting inside the one paragraph whose job is to stop a reader
     * over-reading the number.
     *
     * 🔴 **AND THE 2026-09-01 CORRECTION WAS ITSELF WRONG, WHICH IS WHY THIS BLOCK IS BEING
     * REWRITTEN A SECOND TIME.** It replaced "most" with "at most" and pinned the result — but the
     * cap does NOT bound the figure from above. `REFER_TO_UNITS` checks `event.unitIds.length`
     * per CALL, never the lifetime total, and a declined movement sits in `destination_review`,
     * which is referrable. **There is no ceiling at all.** The earlier fix made a false sentence
     * less wrong, kept its false half, and then pinned that half with an assertion — so the next
     * reader met a guard where the defect was.
     *
     * ⚠️ **A CORRECTION THAT PINS ITS OWN REMAINDER IS WORSE THAN NO CORRECTION**, because the
     * pin certifies the part nobody re-read. Two assertions three lines apart both stood over the
     * same false claim, and both were green.
     *
     * What is pinned now is the property the paragraph exists to protect: the note must say the
     * total is unmeasured, and must not offer any bound on it.
     */
    expectSays(why, "the unmeasured-total claim", [
      "nothing on the record measures",
      "the record does not measure",
      "no record of how many",
    ]);
    expectSays(why, "the what-is-unmeasured clause", ["how many wards", "how many have been asked"]);
    expectSays(why, "the no-ceiling claim", ["no ceiling", "no upper bound", "no limit on how many"]);

    /*
     * ⚠️ **THE BAN HERE ALSO CARRIED `at most`, AND IT WAS THE SAME FIGHTER AS THE ONE REMOVED
     * ABOVE — three lines from a comment warning that a correction which pins its own remainder is
     * worse than no correction.** Dropped, and NOT because the claim stopped mattering: a maximum
     * offered on the lifetime total is exactly the defect this block was rewritten twice to remove.
     * It is now caught by the sentence-level property earlier in this same test, which requires any
     * maximum to say in the same sentence that it bounds wards deciding TOGETHER. That catches the
     * false claim in wordings this regex never could, and — measured, not argued — it passes on
     * "a movement is live at at most three wards at once", which is true, which the page may
     * legitimately say, and which this regex went red on.
     *
     * What remains here is the one phrase that is false however it is qualified: a claim about how
     * many of the counted movements reached any particular number, which is a distribution no line
     * of source can witness.
     */
    expectNeverSaysAgain(why, "the refused-so-far ceiling note", [
      "most of what is counted",
      "most of these",
      "most of them",
    ]);
  });

  /**
   * ⚠️ **THE SUBTRACTION MUST BE ON THE PAGE.** The shared derivation classifies an escalation
   * first, so an escalated movement meeting the same condition is missing from the count. That
   * makes the count a floor, and a floor presented as a total is the quiet half-truth this page
   * exists to avoid.
   */
  it("discloses the escalated movements the count cannot see", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({
          id: "WF-C",
          referredUnitIds: [],
          declines: [{ unitId: "unit-1", at: 0, reason: "no_bed" }],
          escalation: { at: 0, triedUnitIds: ["unit-1"], contact: "State bed coordination" },
        }),
      ],
    });

    // It meets the condition and is not in the count — the page must not report 1 here.
    expect(screen.getByTestId("ward-statistics-refused-so-far-value").textContent).toBe("0");

    const escalated = normalise(screen.getByTestId("ward-statistics-refused-so-far-escalated").textContent);
    expect(escalated).toContain("1 open movement carries a recorded escalation");
    expectSays(escalated, OF_ESC, ["floor"]);
    // And the escalation must be described as an opinion, never as a derived fact — a page that
    // treated it as a terminal marker would be publishing somebody's judgement as a measurement.
    expect(escalated).toContain("recorded opinion");
  });
});

/**
 * FIGURE 4 — SEVEN MEMBERS, SEVEN ROWS, INCLUDING THE ONES AT NOUGHT.
 */
describe("declines by reason — generated from the model's vocabulary", () => {
  /**
   * ⚠️ **THE RENDERED ROWS ARE COMPARED AGAINST `DECLINE_REASONS` ITSELF.** A list typed into this
   * test would be a second copy of the vocabulary and would agree with a hand-written table in the
   * component while both disagreed with the model. A brief carrying a member name a rename had
   * already replaced proved on 2026-09-01 what that costs.
   */
  it("renders one row per member, in the model's order", () => {
    // Vacuity guard: an empty vocabulary would satisfy the comparison by having nothing in it.
    expect(DECLINE_REASONS.length).toBeGreaterThan(0);

    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const rows = within(screen.getByTestId("ward-statistics-declines-by-reason-list")).getAllByRole("listitem");
    expect(rows.length).toBe(DECLINE_REASONS.length);
    // Order as well as membership: the vocabulary's own order is not a ranking, and a component
    // that started sorting by count would still pass a membership-only check.
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      DECLINE_REASONS.map((reason) => `ward-statistics-decline-${reason}`),
    );
    // And the page states the denominator from the same list rather than typing it.
    expect(screen.getByTestId("ward-statistics-declines-by-reason-vocabulary-size").textContent).toBe(
      String(DECLINE_REASONS.length),
    );
  });

  /**
   * ⚠️ **AN UNUSED REASON IS A RENDERED NOUGHT, NOT A MISSING ROW.** A missing row is what a broken
   * generator produces as well, and the two are indistinguishable on the page. This is the test
   * that would fail if somebody reintroduced a filter.
   */
  it("shows a nought for a reason nobody used rather than dropping its row", () => {
    const [used, unused] = [DECLINE_REASONS[0], DECLINE_REASONS[1]];
    expect(used).not.toBe(unused);

    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [movement({ id: "WF-D", declines: [{ unitId: "unit-1", at: 0, reason: used }] })],
    });

    expect(screen.getByTestId(`ward-statistics-decline-${used}-count`).textContent).toBe("1");
    expect(screen.getByTestId(`ward-statistics-decline-${unused}-count`).textContent).toBe("0");
  });

  it("counts declines across movements and states the population they came from", () => {
    const [first, second] = [DECLINE_REASONS[0], DECLINE_REASONS[1]];

    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({
          id: "WF-E",
          declines: [
            { unitId: "unit-1", at: 0, reason: first },
            { unitId: "unit-2", at: 0, reason: first },
          ],
        }),
        movement({ id: "WF-F", declines: [{ unitId: "unit-3", at: 0, reason: second }] }),
        movement({ id: "WF-G", declines: [] }),
      ],
    });

    // 2 + 1 = 3, from 2 of 3 movements. Every expectation a literal.
    expect(screen.getByTestId("ward-statistics-declines-by-reason-total").textContent).toBe("3");
    expect(screen.getByTestId("ward-statistics-declines-by-reason-movements-with").textContent).toBe("2");
    expect(screen.getByTestId("ward-statistics-declines-by-reason-movements").textContent).toBe("3");
    expect(screen.getByTestId(`ward-statistics-decline-${first}-count`).textContent).toBe("2");
    expect(screen.getByTestId(`ward-statistics-decline-${second}-count`).textContent).toBe("1");
  });

  /**
   * ⚠️ **THE ROWS MUST SUM TO THE TOTAL ON THE SCREEN, not only in the derivation.** This is what
   * makes the table readable as a partition of the declines rather than as a selection from them,
   * and it is computed by reading the rendered numerals back — a row lost between the derivation
   * and the DOM breaks it where a derivation-level check would not.
   */
  it("has rendered rows that sum to the rendered total", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({ id: "WF-H", declines: [{ unitId: "unit-1", at: 0, reason: DECLINE_REASONS[0] }] }),
        movement({
          id: "WF-I",
          declines: [
            { unitId: "unit-2", at: 0, reason: DECLINE_REASONS[2] },
            { unitId: "unit-3", at: 0, reason: DECLINE_REASONS[0] },
          ],
        }),
      ],
    });

    const rendered = DECLINE_REASONS.map((reason) =>
      Number(screen.getByTestId(`ward-statistics-decline-${reason}-count`).textContent),
    );
    expect(rendered.reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(screen.getByTestId("ward-statistics-declines-by-reason-total").textContent).toBe("3");
  });

  /**
   * ⚠️ **THIS FIGURE NAMES NO WARD, AND THE WITHHELD PER-WARD BLOCK MUST STILL BE THERE BESIDE IT.**
   * The two are easy to confuse and the confusion is the dangerous direction: a by-reason table
   * read as a per-ward one would decide, silently, the very question the owner reserved.
   */
  it("names no ward, and leaves the per-ward figure withheld", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [movement({ id: "WF-J", declines: [{ unitId: "rph-adult-secure", at: 0, reason: "no_bed" }] })],
    });

    const block = normalise(screen.getByTestId("ward-statistics-declines-by-reason").textContent);
    // The unit id is on the record the tally was built from, and must not reach the page.
    expect(block).not.toContain("rph-adult-secure");
    expect(block).toContain("This names no ward");
    // The front-door boundary, in the one durable sentence: which referral reasons a screen can
    // even offer is a fact about the software, so no distribution over them belongs here.
    expectSays(block, OF_REASON, ["front door"]);

    expect(screen.getByTestId("ward-statistics-declines-withheld")).toBeTruthy();
  });
});

describe("blocked discharges by reason — generated from the model's blocker vocabulary", () => {
  /**
   * ⚠️ **THE RENDERED ROWS ARE COMPARED AGAINST `BED_RELEASE_BLOCKERS` ITSELF**, the same discipline
   * `declinesByReason`'s own DOM test holds to and for the same reason: a list typed into this test
   * would be a second copy of the vocabulary, free to agree with a hand-written component table while
   * both disagreed with the model.
   */
  it("renders one row per member, in the model's own order", () => {
    // Vacuity guard: an empty vocabulary would satisfy the comparison by having nothing in it.
    expect(BED_RELEASE_BLOCKERS.length).toBeGreaterThan(0);

    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    // getByTestId throws (rather than returning null) when the list is absent, so a regression that
    // removes the figure fails here loudly instead of producing a silent empty-array comparison.
    const rows = within(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-list")).getAllByRole(
      "listitem",
    );
    expect(rows.length).toBe(BED_RELEASE_BLOCKERS.length);
    // Order as well as membership: the vocabulary's own order is not a ranking.
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      BED_RELEASE_BLOCKERS.map((reason) => `ward-statistics-blocked-discharge-${reason}`),
    );
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-vocabulary-size").textContent).toBe(
      String(BED_RELEASE_BLOCKERS.length),
    );
  });

  /**
   * ⚠️ **AN UNUSED BLOCKER IS A RENDERED NOUGHT, NOT A MISSING ROW.** A missing row is what a broken
   * generator produces too, and the two look identical on the page. This is the test that would fail
   * if somebody reintroduced a filter that only rendered blockers in use.
   */
  it("shows a nought for a blocker nobody used rather than dropping its row", () => {
    const [used, unused] = [BED_RELEASE_BLOCKERS[0], BED_RELEASE_BLOCKERS[1]];
    expect(used).not.toBe(unused);

    renderScreen({
      admissions: [admission({ id: "AD-USED", blockReason: used })],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${used}-count`).textContent).toBe("1");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${unused}-count`).textContent).toBe("0");
  });

  it("counts blocked admissions across the ward and states the population they came from", () => {
    const [first, second] = [BED_RELEASE_BLOCKERS[0], BED_RELEASE_BLOCKERS[1]];

    renderScreen({
      admissions: [
        admission({ id: "AD-A", blockReason: first }),
        admission({ id: "AD-B", blockReason: first }),
        admission({ id: "AD-C", blockReason: second }),
        admission({ id: "AD-D", blockReason: null }),
      ],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    // 2 + 1 = 3 blocked, out of 4 admissions still on the ward. Every expectation a literal.
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("3");
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-admissions").textContent).toBe("4");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${first}-count`).textContent).toBe("2");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${second}-count`).textContent).toBe("1");
  });

  /**
   * ⚠️ **A DEPARTED ADMISSION IS EXCLUDED, EVEN THOUGH ITS RECORD STILL CARRIES A BLOCK REASON.**
   * The same scoping `wardStatistics` applies to `readyToLeaveCannot`: somebody who has already left
   * is no longer being held from leaving, whatever the record still says. Proved on the rendered page
   * rather than only in the derivation, because a component-level filter added later could reintroduce
   * the departed admission without the arithmetic test noticing.
   */
  it("excludes a departed admission from both the population and its blocker's tally", () => {
    const blocker = BED_RELEASE_BLOCKERS[0];

    renderScreen({
      admissions: [
        admission({ id: "AD-STILL-HERE", state: "occupied", blockReason: blocker }),
        admission({ id: "AD-DEPARTED", state: "departed", blockReason: blocker }),
      ],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-admissions").textContent).toBe("1");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${blocker}-count`).textContent).toBe("1");
  });

  /**
   * ⚠️ **THE ROWS MUST SUM TO THE TOTAL ON THE SCREEN, not only in the derivation.** Computed by
   * reading the rendered numerals back, so a row lost between the derivation and the DOM breaks it
   * where a derivation-level check would not.
   */
  it("has rendered rows that sum to the rendered total", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-E", blockReason: BED_RELEASE_BLOCKERS[0] }),
        admission({
          id: "AD-F",
          blockReason: BED_RELEASE_BLOCKERS[2],
        }),
        admission({ id: "AD-G", blockReason: BED_RELEASE_BLOCKERS[0] }),
      ],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    const rendered = BED_RELEASE_BLOCKERS.map((reason) =>
      Number(screen.getByTestId(`ward-statistics-blocked-discharge-${reason}-count`).textContent),
    );
    expect(rendered.reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("3");
  });

  /**
   * ⚠️ **THE FIGURE SAYS WHICH RECORD ITS BLOCKER SITS ON, AND RULES OUT THE OTHER ONE, ON THE PAGE.**
   * The deferral this figure corrects named the wrong field, so the distinction is the content here
   * rather than decoration: a reader who already knows the trap can see the page got it right
   * without opening the source.
   *
   * 🔴 The two field names were the way it said this until 2026-09-06, when the owner ruled internal
   * identifiers off the prototype. They are asserted in the source instead, by the identifier guard
   * above — which is why this can be re-pointed at the distinction without the claim going unchecked.
   */
  it("says which record the blocker sits on and rules out the other", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const block = screen.getByTestId("ward-statistics-blocked-discharges-by-reason").textContent ?? "";
    const OF_BLOCKED = "the blocked-discharges figure";
    expectSays(block, OF_BLOCKED, ["against the ADMISSION", "against the admission", "Admission.blockReason"]);
    expectSays(block, OF_BLOCKED, ["against a movement", "Movement.blocker"]);
  });

  /**
   * ⚠️ **A NOUGHT RENDERS AS A NUMERAL, NEVER AS AN ABSENCE.** This figure is a genuine count with
   * no "nothing to measure" state anywhere in its shape — unlike `pull-to-arrival`'s average, an
   * empty population here is not unmeasurable, it is a measurement of zero. The count element is
   * asserted to actually contain the character "0" rather than being merely non-empty, so a
   * regression that rendered the total as blank or a dash on an empty world would fail here.
   */
  it("renders nought blocked discharges as a literal zero for a world with no admissions at all", () => {
    // The array-length guard required before any loop below carries an assertion, so a vocabulary
    // collapsed to `[]` cannot make the loop pass by iterating zero times.
    expect(BED_RELEASE_BLOCKERS.length).toBe(8);

    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-admissions").textContent).toBe("0");
    // `expect.soft()` so every row is checked and reported even if one fails — a plain `expect` here
    // would abort the loop at the first red row and hide every row after it.
    for (const reason of BED_RELEASE_BLOCKERS) {
      expect.soft(screen.getByTestId(`ward-statistics-blocked-discharge-${reason}-count`).textContent).toBe("0");
    }
  });
});
