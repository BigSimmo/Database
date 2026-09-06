import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: the section frame renders next/link anchors and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import type { Admission } from "@/components/ward-management/ward-admissions";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

/**
 * 🔴 **THE DISCHARGE-DATES SENTENCE PRESENTS TWO POPULATIONS AS ONE, AND THE DERIVATION SAID SO IN
 * ADVANCE.** Found on 2026-09-06 by opening a ward page, which rendered:
 *
 * > Of 1 with a date written down, 1 met, 0 missed and 11 moved.
 *
 * Eleven of one. Every number there is CORRECT — which is what makes this the dangerous kind. The
 * arithmetic is right, the types are right, and `ward-statistics.ts` states the rule the screen
 * breaks, in its own doc comment, one file away:
 *
 * > `met`/`missed`/`moved` are therefore NOT a three-way partition of the same population and must
 * > never be summed to `consideredCount`.
 *
 * `moved` is counted over EVERY admission on the ward. `met` and `missed` are counted only over the
 * admissions that have both a date and have actually left. `consideredCount` is `met + missed`. So
 * `moved` is drawn from a strictly larger population, and "Of N …, X met, Y missed and Z moved"
 * puts all three inside the one denominator the clause opens with.
 *
 * ⚠️ **AND THE EMPTY BRANCH STATES A FALSEHOOD RATHER THAN A DIFFERENT TRUTH.** It fires on
 * `consideredCount === 0`, which means "no outcome has resolved yet", and it says *no admission on
 * this ward has had a discharge date written down*. On a ward whose every admission carries a
 * planned discharge date and where nobody has left yet, that sentence is untrue — and it is the
 * reading a coordinator would act on, because it says the planning has not happened.
 *
 * ⚠️ **THE SAME BRANCH SILENTLY DROPS `moved`.** A ward with no resolved outcome and eight revised
 * discharge dates publishes neither number, and asserts the absence of the first.
 *
 * 🔴 **NOTHING HERE ASSERTS A WORDING, AND THAT IS DELIBERATE.** Ward Lead's standing rule is to
 * guard the claim and the clinical property, never the rendering — and a wording pin would go green
 * again on any of the three rephrasings that leave the defect in place. These assert the property:
 * a figure may not be presented inside a total it exceeds, and the page may not assert an absence
 * the fixture contradicts. Reword the block however you like and they stay green.
 */

const UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

const DAY = 24 * 60;
const NOW = 400 * DAY;

function anAdmission(overrides: Partial<Admission>): Admission {
  return {
    id: "ADM-x",
    unitId: UNIT!.id,
    specialling: false,
    referralId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: 10 * DAY,
    arrivedAt: 10 * DAY,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    leftAt: null,
    blockReason: null,
    ...overrides,
  } as Admission;
}

/** Planned discharge, still in the bed. Contributes to `moved`, never to `met`/`missed`. */
function planned(id: string, moves: number): Admission {
  return anAdmission({ id, expectedDischargeAt: NOW + 5 * DAY, dischargeDateMoves: moves });
}

/** Planned discharge, and left on time. The only shape `consideredCount` counts. */
function metOnTime(id: string): Admission {
  return anAdmission({ id, expectedDischargeAt: NOW - 2 * DAY, leftAt: NOW - 3 * DAY, state: "departed" });
}

function renderWith(admissions: Admission[]): string {
  render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={UNIT!.id} units={[UNIT!]} admissions={admissions} />
    </WardFlowProvider>,
  );
  return (screen.getByTestId("ward-stat-discharge-outcomes").textContent ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * The numbers a stated total presents as its own parts, and the total itself.
 *
 * Returns `null` when the block does not open with a total — the shape that cannot commit this
 * defect at all. So a rewrite into two sentences is not failed by this helper, it is excused by it,
 * which is the point: the property is about a total swallowing figures drawn from a wider
 * population, never about which words carry it.
 */
function totalAndFiguresInsideIt(text: string): { total: number; inside: number[] } | null {
  const opener = /\bOf (\d[\d,]*)\b/u.exec(text);
  if (!opener) return null;
  const clause = text.slice(opener.index).split(/(?<=\.)\s/u)[0];
  const numbers = [...clause.matchAll(/\b(\d[\d,]*)\b/gu)].map((match) => Number(match[1].replace(/,/gu, "")));
  return { total: numbers[0], inside: numbers.slice(1) };
}

describe("the discharge-dates block keeps its two populations apart", () => {
  it("never presents a figure inside a total it exceeds", () => {
    // One resolved outcome, and eleven other admissions on the same ward whose planned date moved.
    // Built from the model's rules rather than lifted from the seed, so a reseed cannot quietly
    // retire the case that is live on the page today.
    const admissions = [metOnTime("ADM-met"), ...Array.from({ length: 11 }, (_, index) => planned(`ADM-p${index}`, 2))];

    const stats = wardStatistics(UNIT!.id, admissions, NOW);
    // Anti-vacuity: if these ever coincide the fixture has stopped exercising the defect, and the
    // whole test would pass over nothing.
    expect(
      stats.dischargeDateOutcomes.moved,
      "this fixture no longer has more moved admissions than considered ones, so it cannot detect the two populations being merged",
    ).toBeGreaterThan(stats.dischargeDateOutcomes.consideredCount);

    const text = renderWith(admissions);
    const presented = totalAndFiguresInsideIt(text);
    if (presented === null) return; // no single stated total — the shape that cannot commit this

    for (const figure of presented.inside) {
      expect(
        figure,
        `the discharge-dates block reads "${text}". A figure larger than the total the sentence ` +
          "opens with is being presented as part of it. `moved` is counted over every admission on " +
          "the ward; `met` and `missed` only over the ones with a resolved outcome — so they cannot " +
          "share a denominator. Give the wider figure its own population, in words.",
      ).toBeLessThanOrEqual(presented.total);
    }
  });

  it("does not claim no discharge date was written down while dates are on the record", () => {
    // Every admission carries a planned discharge date; none has left. `consideredCount` is 0 —
    // which means "no outcome yet", not "no date".
    const admissions = [planned("ADM-a", 0), planned("ADM-b", 1), planned("ADM-c", 2)];

    const stats = wardStatistics(UNIT!.id, admissions, NOW);
    expect(
      stats.dischargeDateOutcomes.consideredCount,
      "this fixture no longer produces an unresolved-outcome ward, so it cannot reach the empty branch",
    ).toBe(0);
    expect(
      admissions.filter((admission) => admission.expectedDischargeAt !== null),
      "this fixture no longer carries any written-down discharge date, so the falsehood it exists to catch would be true",
    ).not.toHaveLength(0);

    /*
     * ⚠️ THE FIRST VERSION OF THIS ASSERTION BANNED THE PHRASE "date written down" NEAR A "no", AND
     * IT WOULD HAVE FAILED AN HONEST REWRITE. "No admission has BOTH a date written down AND a
     * departure to judge it against" is true, is the correction, and contains every banned word. A
     * guard that red-lights the fix is worse than no guard, so the property is stated properly:
     *
     *   an absence claim must name what is actually absent.
     *
     * `consideredCount === 0` means no outcome has RESOLVED. A sentence denying the date without
     * naming the departure or the outcome is claiming the wrong absence, whatever its wording.
     */
    const text = renderWith(admissions);
    const offending = text
      .split(/(?<=\.)\s+/u)
      .filter((sentence) => /\bno\b|\bnone\b|\bnot\b/iu.test(sentence))
      .filter((sentence) => /date(s)? (has been |have been )?written down|written down/iu.test(sentence))
      .filter((sentence) => !/left|depart|outcome|judge|resolv/iu.test(sentence));

    expect(
      offending,
      `the discharge-dates block reads "${text}", on a ward where every admission carries a planned ` +
        "discharge date. The sentence above denies that a date was written down without naming the " +
        "departure or the outcome — but consideredCount === 0 means no outcome has RESOLVED, which " +
        "is a different absence. Name the one that is real and this passes, however you word it.",
    ).toEqual([]);
  });

  it("still publishes revised discharge dates when no outcome has resolved", () => {
    const admissions = [planned("ADM-a", 0), planned("ADM-b", 1), planned("ADM-c", 2)];

    const stats = wardStatistics(UNIT!.id, admissions, NOW);
    expect(
      stats.dischargeDateOutcomes.moved,
      "this fixture no longer has any revised date, so a page that dropped every revised date would pass",
    ).toBeGreaterThan(0);

    const text = renderWith(admissions);
    expect(
      text,
      `the discharge-dates block reads "${text}". ${stats.dischargeDateOutcomes.moved} admissions on ` +
        "this ward have had their discharge date revised, and the page publishes neither the figure " +
        "nor the fact. An unresolved outcome is not a reason to withhold a measure that IS resolved.",
    ).toMatch(new RegExp(`\\b${stats.dischargeDateOutcomes.moved}\\b`, "u"));
  });
});
