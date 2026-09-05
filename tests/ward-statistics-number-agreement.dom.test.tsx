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
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **A COUNT OF ONE IS THE ONLY VALUE THAT CAN BREAK A SENTENCE, AND NO FIXTURE PRODUCED IT.**
 *
 * Found on 2026-09-06 on a live page: *"1 of the 4 above are flagged urgent."* The count was right.
 * The seed simply never handed these screens a one while anybody was looking, and nought and two
 * both read correctly, so every screenshot and every existing test agreed the sentence was fine.
 *
 * ⚠️ **THE ESTATE ALREADY DOES THIS EVERYWHERE ELSE, WHICH IS WHY THIS IS A DEFECT AND NOT A
 * STYLE.** `ward-board.tsx`, `ed-home.tsx`, `out-of-area-board.tsx`, `patient-typeahead.tsx`,
 * `delays-screen.tsx` and `community-index.tsx` all switch the noun or the verb on the count — and
 * so does `statistics-screen.tsx`, the statistics HOME page, meticulously, in all seven of its
 * count sentences. The per-ward and per-department pages were the two files in that family that
 * did not, so they read as a lapse against their own neighbours rather than as a decision.
 *
 * **THE FIXTURE IS THE ARGUMENT: exactly one of everything.** One admission, carrying every state
 * this screen counts at once, so a single render exercises every count sentence at the one value
 * that can break it. A test parameterised over 0, 1 and 2 would pass at two-thirds strength and
 * report a hit rate rather than a defect.
 *
 * ⚠️ **THIS GUARDS A RENDERING, DELIBERATELY, AND THAT IS NOT THE USUAL RULE.** Ward Lead's
 * standing instruction is to guard the claim and never the rendering — because a wording pin goes
 * green on a rephrasing that leaves the defect in place. Number agreement is the exception that
 * proves it: the defect IS in the rendering, the claim underneath was correct the whole time, and
 * there is nothing else to assert. So this checks agreement and nothing else. It says nothing about
 * which words are used, only that a one is not followed by a plural.
 */

const UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

const DAY = 24 * 60;

/**
 * 🔴 **THE CLOCK IS THE PROVIDER'S, NOT THE TEST'S, AND MY FIRST FIXTURE IGNORED THAT.**
 *
 * `StatisticsWardScreen` takes `admissions` as a prop but reads `now` from `useWardFlow()`, so an
 * admission timed against a `NOW` of the test's own choosing lands in the FUTURE and is skipped by
 * every derivation that compares against the clock. My first version did exactly that: it looked
 * like one admission of every kind and rendered "0.5 days" and "None. No admission on this ward has
 * passed three months." Two of the five measures were not being exercised at all.
 *
 * Instants here are therefore relative to `NOW_ANCHOR`, and go negative, which is correct — the
 * anchor is 642 minutes into day zero, so any real history is a negative instant.
 */
const NOW = NOW_ANCHOR;

const BASE = {
  unitId: UNIT!.id,
  specialling: false,
  referralId: null,
  sex: "Female",
  homeRegion: "Perth Metropolitan",
  tentativeDiagnosis: null,
  state: "occupied",
  awayAtEmergencyDepartmentSince: null,
  expectedDischargeAt: null,
  dischargeDateMoves: 0,
  dischargeDateSetAt: null,
  dischargeDateSetBy: null,
  leftAt: null,
  blockReason: null,
};

function admission(overrides: Record<string, unknown>): Admission {
  return { ...BASE, id: "ADM-1", pulledAt: NOW - DAY, arrivedAt: NOW - DAY, ...overrides } as unknown as Admission;
}

/**
 * ONE CASE PER MEASURE, EACH TUNED SO THAT MEASURE IS EXACTLY ONE.
 *
 * 🔴 **A SINGLE COMBINED FIXTURE CANNOT DO THIS, AND PRETENDING OTHERWISE IS HOW THE FIRST VERSION
 * PASSED OVER TWO UNTESTED MEASURES.** An average stay of one day and a stay of over three months
 * are contradictory demands on the same ward, so no one render can put a `1` in both. Five renders
 * can. The anti-vacuity assertion is then per-measure rather than "at least one of them" — which is
 * the difference between proving coverage and proving that the file found something somewhere.
 */
const CASES = [
  {
    testId: "ward-stat-length-of-stay",
    // One completed stay, exactly one day long, so the average is 1 and not 1.4 or 0.5.
    admissions: [admission({ state: "departed", arrivedAt: NOW - 2 * DAY, leftAt: NOW - 1 * DAY })],
  },
  {
    testId: "ward-stat-empty-bed-minutes",
    // The bed stood empty for exactly one minute between the pull and the arrival.
    admissions: [admission({ pulledAt: NOW - DAY - 1, arrivedAt: NOW - DAY })],
  },
  {
    testId: "ward-stat-ready-blocked",
    admissions: [admission({ blockReason: "awaiting-transport" })],
  },
  {
    testId: "ward-stat-long-stays",
    admissions: [admission({ arrivedAt: NOW - 200 * DAY, pulledAt: NOW - 200 * DAY })],
  },
  {
    testId: "ward-stat-discharge-outcomes",
    // One judged outcome, and one revised date — the two populations that must not merge.
    admissions: [
      admission({
        id: "ADM-judged",
        state: "departed",
        arrivedAt: NOW - 3 * DAY,
        expectedDischargeAt: NOW - 1 * DAY,
        leftAt: NOW - 2 * DAY,
      }),
      admission({ id: "ADM-revised", expectedDischargeAt: NOW + 5 * DAY, dischargeDateMoves: 1 }),
    ],
  },
] as const;

/**
 * A "1" presented as though it were several.
 *
 * Two shapes, and nothing else: a one followed by a plural verb before the sentence ends, and a one
 * followed directly by a plural noun. `-ss` words (`address`, `less`) are not plurals, and neither
 * is a decimal like `1.5`, which is correctly plural — both are excluded rather than allowlisted by
 * name, so a new word cannot quietly need an entry here.
 */
function disagreements(text: string): string[] {
  const found: string[] = [];
  for (const sentence of text.split(/(?<=\.)\s+/u)) {
    for (const match of sentence.matchAll(/(?<![\d.])1(?![\d.])\s+([a-z]+)/gu)) {
      const next = match[1];
      if (/(?:^|\s)(are|have|were|do)$/u.test(next)) found.push(`"1 ${next}" in "${sentence.trim()}"`);
      else if (/s$/u.test(next) && !/ss$/u.test(next)) found.push(`"1 ${next}" in "${sentence.trim()}"`);
    }
    /*
     * A one and a plural verb separated by a clause: "1 of the 4 above are flagged urgent."
     *
     * ⚠️ **THE SUBJECT TEST IS THE WHOLE DIFFICULTY, AND THE FIRST VERSION OF IT WAS WRONG.** It
     * only forgave an intervening plural that carried its own DIGIT, so it red-flagged
     *
     *     "1 day, averaged over the admissions on this ward that have both arrived and left."
     *
     * which is correct English — "have" is governed by "the admissions", not by the one. A guard
     * that fails honest copy is the same fault as a guard that passes broken copy, and it is the
     * more expensive one, because the reflex is to change the sentence.
     *
     * So the rule is: any plural noun between the one and the verb takes the subject, and the one
     * is off the hook. Digits are irrelevant to that.
     */
    const verbMatch = /\b(are|have|were)\b/u.exec(sentence);
    const oneAt = sentence.search(/(?<![\d.])1(?![\d.])/u);
    if (verbMatch && oneAt !== -1 && verbMatch.index > oneAt && verbMatch.index - oneAt <= 60) {
      const between = sentence.slice(oneAt, verbMatch.index);
      const interveningPlural = /\b[a-z]{3,}(?<![aeious])s\b/u.test(between);
      if (!interveningPlural) found.push(`a one governing "${verbMatch[1]}" in "${sentence.trim()}"`);
    }
  }
  return [...new Set(found)];
}

describe("every ward statistic reads correctly when its count is one", () => {
  it.each(CASES)("$testId reads correctly at a count of one", ({ testId, admissions }) => {
    const view = render(
      <WardFlowProvider>
        <StatisticsWardScreen unitId={UNIT!.id} units={[UNIT!]} admissions={admissions as unknown as Admission[]} />
      </WardFlowProvider>,
    );
    const text = (screen.getByTestId(testId).textContent ?? "").replace(/\s+/gu, " ").trim();
    view.unmount();

    // Anti-vacuity, PER MEASURE. The first version of this file asked only whether SOME measure
    // rendered a one, and passed while two of the five rendered "0.5 days" and "None." — a fixture
    // aimed at the wrong clock. A file that proves it found something somewhere is not a file that
    // proves coverage.
    expect(
      /(?<![\d.])1(?![\d.])/u.test(text),
      `${testId} did not render a count of one — it reads "${text}". This case exists to exercise ` +
        "the one value that can break its sentence, so until it prints a bare 1 it is testing nothing. " +
        "Instants are relative to NOW_ANCHOR and go negative; a fixture timed against any other clock " +
        "lands in the future and is skipped by every derivation that compares against the provider's now.",
    ).toBe(true);

    expect(
      disagreements(text),
      `a count of one is being read as several: "${text}". The statistics home page switches the noun ` +
        "or the verb on every one of its counts, and so does the rest of the ward estate; these pages must too.",
    ).toEqual([]);
  });

  /*
   * ⚠️ **THE DEPARTMENT SCREEN TAKES NO FIXTURE, SO THIS ONE RIDES THE SEED — AND SAYS SO WHEN THAT
   * STOPS WORKING.** `StatisticsEdScreen` reads its movements from the provider and accepts no
   * override, unlike the ward screen above, so the counts are whatever the seed produces. Today
   * `scgh-ed` renders "1 of the 4 above" — the very sentence this was found on.
   *
   * A test that quietly depends on a fixture accident is the thing the sibling precision suite was
   * written to warn about, so the dependency is made to report itself: every department is walked,
   * and if NOT ONE of them renders a count of one any more, the anti-vacuity assertion fails by name
   * and tells whoever reseeded that the case has gone. It does not fail the reseed — it asks for a
   * department that still exercises it, or for this screen to gain the override the ward screen has.
   */
  it("finds no plural attached to a one on any department page", () => {
    const departments = allEmergencyDepartments();
    expect(departments, "ward-sites.ts lists no emergency departments at all").not.toHaveLength(0);

    const rendered = departments.map((department) => {
      const view = render(
        <WardFlowProvider>
          <StatisticsEdScreen edId={department.id} />
        </WardFlowProvider>,
      );
      const text = ["ward-stat-ed-on-the-list", "ward-stat-ed-urgent", "ward-stat-ed-unplaced"]
        .map((testId) => screen.getByTestId(testId).textContent ?? "")
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim();
      view.unmount();
      return { name: department.name, text };
    });

    expect(
      rendered.filter((entry) => /(?<![\d.])1(?![\d.])/u.test(entry.text)).map((entry) => entry.name),
      "no department renders a count of one any more, so this test no longer exercises the defect it " +
        "was written for — a one read as several. The seed has moved. Either seed a department back to " +
        "a single urgent or unplaced movement, or give StatisticsEdScreen the movements override the " +
        "ward screen already has and build the fixture here.",
    ).not.toHaveLength(0);

    const problems = rendered.flatMap((entry) => disagreements(entry.text).map((issue) => `${entry.name}: ${issue}`));
    expect(problems, "a count of one is being read as several on a department page").toEqual([]);
  });
});
