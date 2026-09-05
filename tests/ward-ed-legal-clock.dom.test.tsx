import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * 🔴 **A LEGAL CATEGORY DECIDED BY A TIMESTAMP COMPARISON, ON A STATUTORY SURFACE.**
 *
 *     isCommunityFormed   = formedAt !== undefined && formedAt <= openedAt
 *     legalClockReference = isCommunityFormed ? formedAt : openedAt
 *     rendered as           "<duration> since formed" / "since opened"
 *
 * ⚠️ Line numbers are deliberately omitted: an earlier version of this comment carried three, and
 * they were stale within a day of being written. Names survive an edit; offsets do not.
 *
 * A patient formed in the community before reaching a department has a legal clock that started
 * BEFORE the department clock. Get the comparison wrong and the screen says *"since opened"* over a
 * figure that should run from the form — **understating how long a person has been under a legal
 * authority, on the screen where that authority is managed.**
 *
 * ⚠️ **IT GUARDS THE REAL FUNCTIONS THROUGH THE RENDERED SCREEN, and does not export them to do it.**
 * Both values are published as data attributes (`data-community-formed`, `data-minutes-legal-clock`).
 * The functions are module-private, so no unit test can call them; and `ed-screen.tsx` is live on
 * three other ward branches, so widening their visibility to suit a test would change a file three
 * sessions hold.
 *
 * ⚠️ **EVERY DEPARTMENT IS RENDERED, NOT ONE.** The three community-formed movements sit at three
 * DIFFERENT departments — `fsh-ed`, `peel-ed`, `sjgm-ed` — and `ward-movements.ts:352` says that was
 * deliberate, *"so a single-department bug cannot pass."* A guard that rendered one department would
 * be defeated by the very arrangement built to defeat it.
 *
 * 🔴 **THE BOUNDARY IS NOW REACHED AND RULED ON — `<=`, NOT `<`.**
 *
 * **The ruling, 2026-09-05:** a form recorded at the very same minute as arrival IS community
 * formed, so the screen says *"since formed"*. The owner was asked precisely because **the elapsed
 * figure is identical either way** — both references are the same instant — **so the only thing the
 * comparison changes at the boundary is which authority the screen names.** *"Since opened"* over a
 * patient who has a form implies no form was made, which would be untrue.
 *
 * **`WF-013` is the case that discriminates it, and it is the only one.** Its `formedAt` was
 * `NOW_ANCHOR - 200 - 120` and is now equal to its `openedAt`. Changed rather than adding a fourth
 * movement because 73 test files import that fixture and 46 assert an exact count: **editing this
 * row moves no count anywhere** — 50 movements before and after, and 3 community-formed before and
 * after under the shipped rule. Under the old `<` it would be 2, which is what makes it
 * discriminating rather than decorative.
 *
 * ⚠️ **WF-013'S LEGAL CLOCK NOW EQUALS ITS TIME IN DEPARTMENT**, where the other two community-formed
 * movements read strictly older. That is the intended consequence, not a defect.
 *
 * ⚠️ **A `formedAt` STRICTLY AFTER `openedAt` IS STILL NOT COMMUNITY FORMED, AND THAT HALF IS A
 * PLACEHOLDER RATHER THAN A DECISION.** Implementing the ruling's literal words —
 * `formedAt !== undefined` alone — would let `legalClockReference` be dated LATER than `openedAt`,
 * breaking the invariant the third test below asserts. No fixture reaches it; the model does not
 * forbid it. Raised with Ward Lead as a separate question.
 *
 * ⚠️ **THIS FILE IS NOT THE FIRST COVERAGE OF THIS BEHAVIOUR, and an earlier version of this comment
 * implied it was.** `tests/ui-ward-roles.spec.ts:341` already pinned the strictly-older case at
 * `peel-ed` on WF-005 — via the same `data-*` attributes, so a search for the FUNCTION NAMES could
 * not see it. **Absence of a name is not absence of coverage.** What this file adds is unit-level
 * reach across all eight departments, the classification itself, and the boundary. WF-005's
 * 150-minute gap is that spec's fixture assumption and must not be touched.
 *
 * ⚠️ **THREE SOURCE-PARSING COUNTS DISAGREED WITH EACH OTHER BEFORE THE REAL MODULE SETTLED IT** —
 * one regex truncated `NOW_ANCHOR - 95 - 40` to `-95`, making all three cases look EQUAL and very
 * nearly producing a confident report that this whole branch was dead code. **Numbers in this file
 * come from the module, never from reading the fixture.**
 */

const NOW = NOW_ANCHOR;

/** The fixture's own answer, computed from the DATA rather than from the component — which is what
 *  makes the comparison below a check rather than a restatement of the implementation. */
function expectedCommunityFormed(movement: Movement): boolean {
  return movement.formedAt !== undefined && movement.formedAt <= movement.openedAt;
}

type Rendered = { id: string; communityFormed: boolean; legalMinutes: number };

/** Render every department and collect what each patient card actually published. */
function renderAllDepartments(): Map<string, Rendered> {
  const seen = new Map<string, Rendered>();
  for (const department of allEmergencyDepartments()) {
    const { container } = render(
      <WardFlowProvider initialNow={NOW}>
        <EdScreen edId={department.id} />
      </WardFlowProvider>,
    );
    for (const node of Array.from(container.querySelectorAll("[data-minutes-legal-clock]"))) {
      const testid = node.getAttribute("data-testid") ?? "";
      const id = testid.replace("ward-ed-patient-", "");
      const raw = node.getAttribute("data-minutes-legal-clock");
      expect(raw, `${id} published no legal-clock figure`).not.toBeNull();
      seen.set(id, {
        id,
        communityFormed: node.getAttribute("data-community-formed") === "true",
        legalMinutes: Number(raw),
      });
    }
    cleanup();
  }
  return seen;
}

describe("the emergency department's legal clock", () => {
  afterEach(cleanup);

  it("renders a population worth asserting over, across more than one department", () => {
    const seen = renderAllDepartments();
    // ⚠️ FLOOR THE POPULATION WALKED. Every assertion below iterates this map, so an empty or
    // near-empty render would make all of them pass while proving nothing.
    expect(seen.size, "too few patients rendered for the assertions below to mean anything").toBeGreaterThan(8);

    const formed = [...seen.values()].filter((row) => row.communityFormed);
    const expected = wardMovements.filter(expectedCommunityFormed);
    expect(expected.length, "no community-formed movement in the fixture — every check below is vacuous").toBe(3);
    expect(
      formed.length,
      `the fixture holds ${expected.length} community-formed movements; the screens rendered ${formed.length}`,
    ).toBe(expected.length);
  });

  /**
   * 🔴 **THE BOUNDARY THE OWNER RULED ON, pinned by the property rather than by an id.**
   *
   * A movement whose form and arrival share an instant must be community formed and must be labelled
   * *"since formed"*. The case is found by SEARCHING the fixture for equal instants, not by naming
   * WF-013 — so moving the boundary onto a different movement keeps this test meaningful, and
   * removing it altogether fails loudly instead of passing over an empty set.
   */
  it("treats a form recorded in the same minute as arrival as community formed", () => {
    const boundary = wardMovements.filter(
      (movement) => movement.formedAt !== undefined && movement.formedAt === movement.openedAt,
    );
    expect(
      boundary.length,
      "no movement has formedAt === openedAt, so the owner's 2026-09-05 boundary ruling is unguarded",
    ).toBeGreaterThan(0);

    const seen = renderAllDepartments();
    for (const movement of boundary) {
      const row = seen.get(movement.id);
      expect(row, `${movement.id} carries the boundary case but no department rendered it`).toBeDefined();
      if (row === undefined) continue;
      expect(
        row.communityFormed,
        `${movement.id}: formedAt === openedAt === ${movement.openedAt}, so the screen must say "since formed"`,
      ).toBe(true);
      // The figure is identical either way — that is WHY this was a wording question — so asserting
      // the duration here would pass under both rules and prove nothing. The flag is the property.
      expect(row.legalMinutes).toBe(Math.max(NOW - movement.openedAt, 0));
    }
  });

  /**
   * 🔴 **THE SUBJECT.** Which side of the comparison each patient falls, and the figure that follows
   * from it.
   *
   * ⚠️ **MUTATION RESULTS — predicted before running, then measured. Both matched.** A message that
   * differs from the prediction is a finding even when the colour is right.
   *   - `<` to `>` — **CAUGHT**, on both the flag and the figure: *"the fixture holds 3
   *     community-formed movements; the screens rendered 0"* and *"WF-002: formedAt=372
   *     openedAt=462 — the screen says communityFormed=false, the data says true"*. The invariant
   *     test stayed green, as predicted: the legal clock falls back to `openedAt`, never past it.
   *   - `<` to `<=` — **SURVIVED, and that is NOT evidence the check is weak.** No movement in
   *     today's seed has `formedAt === openedAt`, so the two operators are indistinguishable over
   *     this data.
   *
   * 🔴 **THE SURVIVAL IS ONLY INTERPRETABLE BECAUSE THE OTHER MUTATION PROVED THE LOCATION LIVE, and
   * that ordering is the point.** A mutant that never executes, and an assertion that does not cover
   * the property, produce an identical SURVIVED. Flipping the same character at the same location to
   * `>` went red on two assertions and changed rendered output — **so the line executes and its
   * result is observed by these checks.** What remains is a fixture with no discriminating input.
   * **To test whether a location is live: mutate it first in a direction you expect to be CAUGHT,
   * then in the direction you are actually asking about.**
   *
   * Both mutations were restored byte-identical, verified by `git hash-object`.
   */
  it("classifies each patient by whether the form genuinely predates arrival, and dates the clock from it", () => {
    const seen = renderAllDepartments();
    const byId = new Map<string, Movement>(wardMovements.map((movement) => [movement.id, movement]));
    let checked = 0;

    for (const row of seen.values()) {
      const movement = byId.get(row.id);
      expect(movement, `rendered ${row.id} is not in the fixture`).toBeDefined();
      if (movement === undefined) continue;

      const shouldBeFormed = expectedCommunityFormed(movement);
      expect(
        row.communityFormed,
        `${row.id}: formedAt=${String(movement.formedAt)} openedAt=${movement.openedAt} — the screen says ` +
          `communityFormed=${row.communityFormed}, the data says ${shouldBeFormed}`,
      ).toBe(shouldBeFormed);

      const reference = shouldBeFormed ? (movement.formedAt as number) : movement.openedAt;
      expect(row.legalMinutes, `${row.id}: the legal clock is not measured from the instant it names`).toBe(
        Math.max(NOW - reference, 0),
      );
      checked++;
    }
    expect(checked, "no patient was actually compared").toBeGreaterThan(8);
  });

  /**
   * **THE INVARIANT THE DOC COMMENT ALREADY CLAIMS, PROVED RATHER THAN RESTATED.**
   * `legalClockReference`'s comment says it is *"Never earlier than by construction, so the legal
   * clock can never read as running from a LATER instant than the department clock."* A sentence
   * asserting an invariant is not an invariant — this is the same class of unguarded claim as the
   * governance cards, one layer down.
   *
   * Elapsed legal minutes must therefore be at least elapsed department minutes, for every patient.
   */
  it("never dates the legal clock later than the department clock", () => {
    const seen = renderAllDepartments();
    const byId = new Map<string, Movement>(wardMovements.map((movement) => [movement.id, movement]));
    const offenders: string[] = [];
    let compared = 0;

    for (const row of seen.values()) {
      const movement = byId.get(row.id);
      if (movement === undefined) continue;
      const inDepartment = Math.max(NOW - movement.openedAt, 0);
      compared++;
      if (row.legalMinutes < inDepartment) {
        offenders.push(`${row.id}: legal ${row.legalMinutes} < department ${inDepartment}`);
      }
    }

    expect(compared, "nothing compared — the invariant was not tested").toBeGreaterThan(8);
    expect(offenders, `the legal clock started AFTER the department clock:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });
});
