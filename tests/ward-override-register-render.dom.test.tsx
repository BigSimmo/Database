import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { NO_OVERRIDE_RECORDED_NOTICE } from "@/components/ward-management/override-register";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { MovementId } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

import { parseModuleSource, relative, runtimeGraph } from "./helpers/module-graph";

/**
 * THE OVERRIDE REGISTER, READ RATHER THAN MERELY STORED — and the boundary that keeps it an
 * accountability record instead of an audit trail.
 *
 * Owner decision OD-3: a coordinator may overrule a failing bed-matching gate, the reason is kept
 * on `Movement.overrides`, and the record is **visible to the party overridden**. Both derivations
 * that read it back (`allOverrides`, `overridesAgainstUnit`) were fully covered by
 * `tests/ward-override-register.test.ts` and called by nothing but that file — an accountability
 * record no human being could reach. This file covers the read side on screen.
 *
 * ---
 *
 * ## Why the "another ward cannot see it" render test is NOT the guard, and what is
 *
 * "No path exists by which one ward can obtain another's overrides" is a negative existential, and
 * no render assertion can establish one. The leak OD-3 names appears "the moment somebody adds a
 * column, a debug panel, or a styling change that reveals a hidden row" — none of which exist
 * today. So a test that renders ward B and finds ward A's reason absent passes **on the leaking
 * construction too**, as long as that construction happens not to paint the extra row this
 * afternoon. It is a check on today's markup wearing the name of a check on the property.
 *
 * The property is structural: does another ward's data ever REACH the ward screen. If it never
 * enters scope, no future column or stylesheet can reveal it, and the rule holds by construction
 * rather than by vigilance. So the render assertions below are kept — they catch the crude failure
 * — and the block "the ward screen cannot reach the whole register" is what actually establishes
 * it, following `tests/ward-referral-screen-boundary.test.ts`, this repository's own FD-23 guard,
 * including its non-vacuity discipline: a check that cannot fail is worse than no check.
 */

const NOW = NOW_ANCHOR;

/** Two different reasons, from the owner's fixed list and never re-worded. Distinct so a rendered
 *  reason identifies WHICH override produced it rather than merely that some override exists. */
const REASON_A: OverrideReason = OVERRIDE_REASONS[1];
const REASON_B: OverrideReason = OVERRIDE_REASONS[2];

/** Two real units from the fixture, resolved rather than named, so this suite follows the seed. */
const UNIT_A = allUnits()[0];
const UNIT_B = allUnits().find((unit) => unit.id !== UNIT_A.id && !UNIT_A.name.includes(unit.name))!;

/** A movement the reducer will actually accept a referral for — `REFER_TO_UNITS` refuses any other
 *  stage, and a refused dispatch would leave the register empty while every assertion below still
 *  read as though it had been populated. */
const REFERABLE: MovementId = (() => {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.stage === "placement_requested");
  if (!movement) throw new Error("the seed no longer holds a referable movement");
  return movement.id;
})();

/**
 * Makes a real override through the reducer — never by hand-building a `Movement`. The register is
 * only worth rendering if it shows what the live system actually records, and the shortlist panel's
 * override control dispatches exactly this event (`shortlist-panel.tsx`,
 * `handleOverrideSubmit`).
 */
function OverrideHarness({
  unitIds,
  reason,
  children,
}: {
  unitIds: string[];
  reason: OverrideReason;
  children: React.ReactNode;
}) {
  const { now, dispatch, rejections } = useWardFlow();
  return (
    <>
      <button
        type="button"
        data-testid="record-override"
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now,
            movementId: REFERABLE,
            unitIds,
            overrideReason: reason,
          })
        }
      >
        Record the override
      </button>
      {/* A refused dispatch is silent on screen — the reducer collects it in `rejections` instead
          of throwing — so it is surfaced here and asserted below. Without this, a mistyped event
          would leave every register assertion measuring an empty register. */}
      <span data-testid="rejection-count">{rejections.length}</span>
      {children}
    </>
  );
}

function recordOverride() {
  fireEvent.click(screen.getByTestId("record-override"));
  expect(
    screen.getByTestId("rejection-count").textContent,
    "the reducer refused the override — every assertion after this would measure an empty register",
  ).toBe("0");
}

describe("the coordinator's override register", () => {
  it("says so plainly when no override has been recorded, rather than rendering an empty box", () => {
    // The seed ships every movement with `overrides: []`, so this is the state the screen is in
    // before anybody overrules anything. "No rows" and "this surface was never wired up" look
    // identical on screen, and only one of them is true.
    render(
      <WardFlowProvider initialNow={NOW}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const region = screen.getByTestId("ward-coordinator-override-register");
    expect(within(region).getByTestId("ward-override-register-empty")).toHaveTextContent(NO_OVERRIDE_RECORDED_NOTICE);
    expect(within(region).queryByTestId("ward-override-register")).toBeNull();
  });

  it("shows an override that was made — when, by which role, why, and against whom", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <OverrideHarness unitIds={[UNIT_A.id]} reason={REASON_A}>
          <CoordinatorScreen />
        </OverrideHarness>
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-override-register-empty")).toBeInTheDocument();

    recordOverride();

    const region = screen.getByTestId("ward-coordinator-override-register");
    const entry = within(region).getByTestId(`ward-override-entry-${REFERABLE}`);
    // The reason, verbatim from the owner's list.
    expect(within(entry).getByTestId(`ward-override-reason-${REFERABLE}`)).toHaveTextContent(REASON_A);
    // A ROLE, never a person: the reducer writes `WARD_FLOW_ROLE_LABELS[event.role]`.
    expect(within(entry).getByTestId(`ward-override-by-${REFERABLE}`)).toHaveTextContent("Flow coordinator");
    // The party overridden, named.
    expect(within(entry).getByTestId(`ward-override-units-${REFERABLE}`)).toHaveTextContent(UNIT_A.name);
    // And the empty state is gone — a register showing both would be a register showing neither.
    expect(within(region).queryByTestId("ward-override-register-empty")).toBeNull();
  });
});

describe("a ward's own override register", () => {
  it("says so plainly when nothing has been recorded against it", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <WardScreen unitId={UNIT_A.id} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-override-register-empty")).toHaveTextContent(NO_OVERRIDE_RECORDED_NOTICE);
  });

  it("shows the ward an override made against it", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <OverrideHarness unitIds={[UNIT_A.id]} reason={REASON_A}>
          <WardScreen unitId={UNIT_A.id} />
        </OverrideHarness>
      </WardFlowProvider>,
    );
    recordOverride();

    const entry = screen.getByTestId(`ward-override-entry-${REFERABLE}`);
    expect(within(entry).getByTestId(`ward-override-reason-${REFERABLE}`)).toHaveTextContent(REASON_A);
    expect(within(entry).getByTestId(`ward-override-by-${REFERABLE}`)).toHaveTextContent("Flow coordinator");
  });

  it("NEVER shows a ward an override made against a DIFFERENT ward", () => {
    // The crude failure, and the one a leaking implementation can still pass — see this file's
    // header. Kept because it is cheap and because the crude failure is real.
    expect(UNIT_A.id, "the two units must differ or this proves nothing").not.toBe(UNIT_B.id);

    render(
      <WardFlowProvider initialNow={NOW}>
        <OverrideHarness unitIds={[UNIT_A.id]} reason={REASON_B}>
          <WardScreen unitId={UNIT_B.id} />
        </OverrideHarness>
      </WardFlowProvider>,
    );
    recordOverride();

    expect(screen.queryByTestId(`ward-override-entry-${REFERABLE}`)).toBeNull();
    expect(document.body, `${UNIT_B.name} was shown an override recorded against ${UNIT_A.name}`).not.toHaveTextContent(
      REASON_B,
    );
    // And the ward is told the register is empty rather than being shown nothing at all.
    expect(screen.getByTestId("ward-override-register-empty")).toHaveTextContent(NO_OVERRIDE_RECORDED_NOTICE);
  });

  it("never names a CO-OVERRIDDEN ward, even on an override this ward is entitled to see", () => {
    /*
     * FD-23 inside OD-3, and the case the two rules meet in. The shortlist panel's refer control is
     * a multi-select, so one `REFER_TO_UNITS` can name several units and the resulting override's
     * `unitIds` lists every one of them. The row is legitimately this ward's to read — it names
     * this ward — and rendering its `unitIds` verbatim would still tell this ward WHERE ELSE the
     * patient was referred, which the owner ruled on 2026-08-31 that it may not learn.
     * `ward-referral-visibility.ts` adds that "the count is as forbidden as the list", so replacing
     * the other ward with a number is not the fix either.
     */
    render(
      <WardFlowProvider initialNow={NOW}>
        <OverrideHarness unitIds={[UNIT_A.id, UNIT_B.id]} reason={REASON_A}>
          <WardScreen unitId={UNIT_A.id} />
        </OverrideHarness>
      </WardFlowProvider>,
    );
    recordOverride();

    const units = screen.getByTestId(`ward-override-units-${REFERABLE}`);
    expect(units, "the ward must still be told it was the party overridden").toHaveTextContent(UNIT_A.name);
    expect(units, `${UNIT_A.name} was told ${UNIT_B.name} was referred the same patient`).not.toHaveTextContent(
      UNIT_B.name,
    );
    expect(
      units,
      "the co-addressee was replaced by a count — the count is as forbidden as the list",
    ).not.toHaveTextContent(UNIT_B.id);
    expect(document.body, `${UNIT_B.name} reached ${UNIT_A.name}'s screen`).not.toHaveTextContent(UNIT_B.name);
  });
});

// ------------------------------------------------------------------------------------------
// THE STRUCTURAL GUARD. See this file's header for why the render assertions above cannot
// establish the property on their own. Modelled on `tests/ward-referral-screen-boundary.test.ts`.
// ------------------------------------------------------------------------------------------

const WARD_DIR = resolve(process.cwd(), "src/components/ward-management");
const WARD_SCREEN = resolve(WARD_DIR, "ward/ward-screen.tsx");
const COORDINATOR_SCREEN = resolve(WARD_DIR, "coordinator/coordinator-screen.tsx");
const SHARED_PRESENTATION = resolve(WARD_DIR, "override-register.tsx");
/** The module that DEFINES both reads. It necessarily names `allOverrides`, and it is reachable
 *  from the ward screen, so it is subtracted rather than counted as an offender — the same
 *  shape as `ward-referral-screen-boundary.test.ts`'s `SEES_EVERYTHING` subtraction. */
const DEFINES_THE_READS = resolve(WARD_DIR, "ward-derivations.ts");

/**
 * Every identifier a module actually REFERENCES — imports, calls, aliases — and nothing that
 * merely mentions it. Babel drops comments from the node stream, so this file's own prose (and
 * `ward-screen.tsx`'s doc comment, which names `allOverrides` in order to forbid it) is invisible
 * here. That is the point: a regex over the source would fail on a comment explaining the rule,
 * which teaches the next author to delete the explanation.
 */
function identifiersInSource(sourceText: string, label: string): Set<string> {
  const source = parseModuleSource(sourceText);
  // NON-VACUITY, first: a file that failed to parse, or was read as empty, would yield an empty
  // set and make every "does not contain" assertion below pass over nothing.
  expect(source.program.body.length, `${label} parsed to an empty program`).toBeGreaterThan(0);

  const found = new Set<string>();
  const seen = new Set<object>();
  const walk = (node: unknown) => {
    if (node === null || typeof node !== "object") return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    const record = node as { type?: unknown; name?: unknown };
    if (record.type === "Identifier" && typeof record.name === "string") found.add(record.name);
    for (const value of Object.values(record)) walk(value);
  };
  walk(source.program);
  return found;
}

function identifiersIn(filePath: string): Set<string> {
  return identifiersInSource(readFileSync(filePath, "utf8"), relative(filePath));
}

/** Every ward-management module the ward screen can reach, transitively. */
function wardScreenReaches(): string[] {
  const { graph } = runtimeGraph();
  const visited = new Set<string>();
  const queue = [WARD_SCREEN];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const dependency of graph.get(file) ?? []) {
      if (!visited.has(dependency)) queue.push(dependency);
    }
  }
  return [...visited].filter((file) => file.startsWith(WARD_DIR));
}

describe("the ward screen cannot reach the whole override register", () => {
  it("detects the identifiers it is looking for, or the checks below prove nothing", () => {
    // POSITIVE CONTROL. The coordinator screen is entitled to the unrestricted read and really
    // does take it, so this proves a non-empty result for `allOverrides` is reachable — an
    // extractor that found the identifier nowhere would make every assertion below vacuous.
    expect(
      identifiersIn(COORDINATOR_SCREEN),
      "the coordinator screen no longer reads the whole register — the ward scope is then a restriction on nothing",
    ).toContain("allOverrides");

    // And the extractor must find an identifier of exactly this shape IN THE FILE UNDER GUARD, so
    // a resolver pointed at the wrong path cannot report clean.
    expect(
      identifiersIn(WARD_SCREEN),
      "the ward screen no longer reads the ward-scoped register at all — this guard scans nothing",
    ).toContain("overridesAgainstUnit");

    // Pinned in both directions on synthetic sources: a mention in prose is NOT a reference, and a
    // real import IS one. Without this, a walker that silently returned everything (or nothing)
    // would satisfy the two assertions above by accident. Babel keeps comments on the node they
    // lead — they ARE in the tree, just not as identifiers — so a check that scanned the tree
    // wholesale rather than its identifier nodes would fail the first of these, and a guard that
    // punishes a file for explaining its own rule teaches the next author to delete the comment.
    expect(
      identifiersInSource("// never allOverrides here\nexport const x = 1;\n", "prose sample"),
      "a comment naming the forbidden read is being counted as a reference",
    ).not.toContain("allOverrides");
    expect(
      identifiersInSource('import { allOverrides } from "./ward-derivations";\nallOverrides([]);\n', "import sample"),
      "a real import of the forbidden read is not detected — the guard is blind to the thing it exists for",
    ).toContain("allOverrides");
  });

  it("never so much as names allOverrides in the ward screen", () => {
    expect(
      [...identifiersIn(WARD_SCREEN)].filter((name) => name === "allOverrides"),
      `${relative(WARD_SCREEN)} reaches the whole override register. A ward may read only the ` +
        `overrides made against it: call overridesAgainstUnit(movements, unit.id) instead. ` +
        `Filtering allOverrides in the component looks identical in review and leaks every other ` +
        `ward's row the moment somebody adds a column, a debug panel, or a styling change.`,
    ).toEqual([]);
  });

  it("never lets the whole register reach the ward screen through a module in between", () => {
    const reachable = wardScreenReaches().filter((file) => file !== DEFINES_THE_READS);
    // NON-VACUITY. An empty or collapsed graph would make the sweep below pass over nothing, and
    // the shared presentation component is named because it is the one module a leak would most
    // naturally be placed in.
    expect(reachable.length, "the ward screen's module graph collapsed — this sweep scans nothing").toBeGreaterThan(5);
    expect(reachable, "the shared presentation component is not in the swept set").toContain(SHARED_PRESENTATION);
    expect(reachable, "the ward screen itself is not in the swept set").toContain(WARD_SCREEN);

    const offenders = reachable.filter((file) => identifiersIn(file).has("allOverrides")).map(relative);
    expect(
      offenders,
      "a module the ward screen reaches takes the unrestricted read — route it through overridesAgainstUnit()",
    ).toEqual([]);
  });

  it("keeps the shared presentation component unable to tell which view it is serving", () => {
    // It receives an already-scoped `OverrideEntry[]` and calls NEITHER read, so it cannot narrow a
    // list and cannot be handed the whole register "to filter for the ward". If it ever called one
    // of them it would know its audience, and a component that knows its audience can be asked to
    // hide a row — which is one stylesheet away from showing it.
    const identifiers = identifiersIn(SHARED_PRESENTATION);
    expect(
      identifiers,
      "the shared component derives its own list — the scoping decision must stay in the screens",
    ).not.toContain("allOverrides");
    expect(
      identifiers,
      "the shared component scopes to a unit — it would then know which view it serves",
    ).not.toContain("overridesAgainstUnit");
    // Non-vacuity for this file too: it must really be the presentation component.
    expect(identifiers).toContain("OverrideRegister");
  });
});
