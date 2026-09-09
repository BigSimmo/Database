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

import { parseModuleSource, relative, resolveModule, runtimeGraph } from "./helpers/module-graph";

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
 * ⚠️ **THE HOLE THE EXEMPTION ABOVE OPENED, AND WHAT CLOSES IT.** `DEFINES_THE_READS` is subtracted
 * from the swept set because it must legitimately say `allOverrides` — it defines the read. But the
 * exemption was for NAMING the read, not for RENAMING it, and nothing stopped the definer adding a
 * second exported name for the same local binding: `export { allOverrides as networkOverrideRead };`
 * The exempted file still says `allOverrides` (harmless — it is excluded), every ward-reachable
 * consumer says only the new name, and a sweep for the literal string `allOverrides` finds nothing
 * while the whole register is one import away. So instead of forbidding a fixed spelling, the guard
 * asks the definer directly which external names refer to `allOverrides` — every `export { X as Y }`
 * whose LOCAL side is `allOverrides` — and forbids every one of them, not just the original. A
 * definer with no such alias line yields exactly `{"allOverrides"}`, so this changes nothing when
 * the hole is not being used.
 */
/**
 * Three direct export forms, closed enumeration. Anything past one hop —
 * `const x = allOverrides; export { x };` two lines apart, or a value passed through a function
 * — is multi-statement dataflow, and that is a different, open-ended class of fix. It is out of
 * scope on purpose: see "keeps the alias extractor pinned to its three forms, not a fourth" below,
 * which proves the boundary by showing a two-statement launder genuinely escapes this function,
 * rather than merely saying so in this comment.
 */
function exportedAliasesOfSource(localName: string, sourceText: string): Set<string> {
  const source = parseModuleSource(sourceText);
  const aliases = new Set<string>([localName]);
  for (const statement of source.program.body) {
    // Form 1: `export { allOverrides as X };` — the definer's own local export line. Only the
    // definer's OWN local export lines count: `export { allOverrides as x } from "./elsewhere"`
    // would be re-exporting SOMEONE ELSE's `allOverrides`, not this file's binding.
    if (statement.type === "ExportNamedDeclaration" && !statement.source) {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ExportSpecifier") continue;
        if (specifier.local.type !== "Identifier" || specifier.local.name !== localName) continue;
        const exported = specifier.exported;
        aliases.add(exported.type === "Identifier" ? exported.name : exported.value);
      }
      // Form 2: `export const X = allOverrides;` — a fresh binding, exported in the SAME
      // statement, whose initialiser is directly the local one. One hop, not a chain: a
      // declarator whose init is anything other than the bare identifier (a call, a member
      // expression, a second variable) is not this form and is left alone.
      if (statement.declaration && statement.declaration.type === "VariableDeclaration") {
        for (const declarator of statement.declaration.declarations) {
          if (
            declarator.id.type !== "Identifier" ||
            !declarator.init ||
            declarator.init.type !== "Identifier" ||
            declarator.init.name !== localName
          ) {
            continue;
          }
          aliases.add(declarator.id.name);
        }
      }
      continue;
    }
    // Form 3: `export default allOverrides;` — the local binding exported directly as the
    // module's default. The external name a consumer imports it under is "default"
    // (`import { default as x }`, or the equivalent `import x from`), so that is what is added —
    // not the local name, which no consumer of a default export ever writes.
    if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier" &&
      statement.declaration.name === localName
    ) {
      aliases.add("default");
    }
  }
  return aliases;
}

function exportedAliasesOf(localName: string, filePath: string): Set<string> {
  return exportedAliasesOfSource(localName, readFileSync(filePath, "utf8"));
}

/** Every external name that refers to `allOverrides` today, per `DEFINES_THE_READS` itself — not a
 *  fixed literal. Recomputed from the definer, so a future rename is caught without editing this
 *  file, and the ordinary case (no alias) still reduces to the original single-name check. */
const FORBIDDEN_REGISTER_READS = exportedAliasesOf("allOverrides", DEFINES_THE_READS);

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

/**
 * ⚠️ **THE HOLE THE IDENTIFIER SCAN ABOVE CANNOT SEE, VERIFIED LIVE RATHER THAN ASSUMED.**
 * `identifiersInSource` reads what a file CALLS things — every `Identifier` node in its tree,
 * including an import specifier's own local binding name. That accidentally catches
 * `import allOverrides from "…/ward-derivations"`, because the local name the importer chose
 * happens to collide with the forbidden word itself: Babel emits the specifier's local binding
 * as an `Identifier` named `allOverrides`, and `FORBIDDEN_REGISTER_READS` already contains that
 * string. Proved live for this file, 2026-09-03: with `export default allOverrides;` added to
 * `ward-derivations.ts` and `import allOverrides from "@/…/ward-derivations"; void allOverrides;`
 * added to `ward-screen.tsx`, the two identifier-scan tests above went red on their own, with no
 * new check at all. That is a coincidence of spelling, not a structural catch — `import zqBinding
 * from "…/ward-derivations"; void zqBinding;` in the same spot left every test in this file green,
 * because "zqBinding" is not a word `FORBIDDEN_REGISTER_READS` has ever heard of. A default import
 * binds the ENTIRE module to whatever local name the importer picks, so a scan that reads names
 * catches this leak only when the leaker happens to reuse the original name — which is exactly
 * when a leak is least likely to be named, not most.
 *
 * The fix is to stop reading names and start reading RESOLUTION: does the specifier of a default
 * import, resolved on disk from the importing file, land on `DEFINES_THE_READS` — regardless of
 * what the importer calls the binding. Copied from `namespaceOrDefaultReferralImports` and
 * `resolveLocalImport` in `tests/ward-referral-screen-boundary.test.ts` — this repo's own FD-23
 * guard already solved the identical problem for the referral record, and a second independent
 * module-resolution implementation is a liability, not a second opinion. `resolveModule` is the
 * shared resolver `runtimeGraph()` itself is built from, so this check walks the exact same graph
 * `wardScreenReaches()` does rather than a hand-rolled parallel one.
 */
function defaultImportsOfTheDefiner(sourceText: string, fromFile: string): string[] {
  const source = parseModuleSource(sourceText);
  const { fileSet } = runtimeGraph();
  const offenders: string[] = [];
  for (const statement of source.program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const hasDefaultSpecifier = statement.specifiers.some((specifier) => specifier.type === "ImportDefaultSpecifier");
    if (!hasDefaultSpecifier) continue;
    if (resolveModule(fromFile, statement.source.value, fileSet) === DEFINES_THE_READS) {
      offenders.push(statement.source.value);
    }
  }
  return offenders;
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

    // Pinned in both directions for the alias extractor too: a rename AT THE DEFINER'S OWN export
    // line must be tracked, and an alias of some unrelated export must not be mistaken for one.
    // Both samples declare the local binding they export — Babel validates that a named export
    // specifier's local side resolves to a real module-scope binding, so an undeclared name is a
    // parse error, not merely a fact this extractor could get wrong.
    expect(
      [
        ...exportedAliasesOfSource(
          "allOverrides",
          "function allOverrides() {}\nexport { allOverrides as networkOverrideRead };\n",
        ),
      ],
      "a rename at the definer's own export line is not being tracked as a name for allOverrides — the hole this guard exists to close",
    ).toContain("networkOverrideRead");
    expect(
      [
        ...exportedAliasesOfSource(
          "allOverrides",
          "function somethingElse() {}\nexport { somethingElse as networkOverrideRead };\n",
        ),
      ],
      "an alias of an unrelated export is being treated as a name for allOverrides",
    ).not.toContain("networkOverrideRead");
    expect(
      [...exportedAliasesOfSource("allOverrides", "function allOverrides() {}\n")],
      "a definer with no alias line must still forbid the plain name — the ordinary case must not be lost",
    ).toEqual(["allOverrides"]);
  });

  it("covers exactly the three direct export forms, and misses a two-statement launder by construction", () => {
    // THE BOUNDARY, PINNED RATHER THAN COMMENTED. This project has already been bitten once by a
    // comment vouching for a guard that did not exist — so the extractor's limit is proved here by
    // showing what it actually does, not merely written down.

    // The three forms, together, so a future edit that silently drops one of them is caught here
    // rather than by an unbuilt leak.
    const definer = [
      "function allOverrides() {}",
      "export { allOverrides as formOneRename };",
      "export const formTwoConst = allOverrides;",
      "export default allOverrides;",
    ].join("\n");
    const aliases = [...exportedAliasesOfSource("allOverrides", definer)];
    expect(aliases, "form 1 — export { allOverrides as X } — is missing").toContain("formOneRename");
    expect(aliases, "form 2 — export const X = allOverrides — is missing").toContain("formTwoConst");
    expect(aliases, "form 3 — export default allOverrides — is missing").toContain("default");

    // And the boundary itself: a TWO-STATEMENT launder — an intermediate local binding, exported
    // on a LATER line — is multi-statement dataflow, and this function must not follow it. If this
    // assertion ever starts failing, the extractor has grown a fourth form nobody decided to add.
    const twoStatementLaunder = "const launderedName = allOverrides;\nexport { launderedName };\n";
    expect(
      [...exportedAliasesOfSource("allOverrides", twoStatementLaunder)],
      "the extractor now follows a two-statement launder — the multi-statement-dataflow boundary this guard names has moved, and that decision was never made deliberately",
    ).not.toContain("launderedName");
  });

  it("never so much as names allOverrides — or any alias the definer exports for it — in the ward screen", () => {
    expect(
      [...identifiersIn(WARD_SCREEN)].filter((name) => FORBIDDEN_REGISTER_READS.has(name)),
      `${relative(WARD_SCREEN)} reaches the whole override register. A ward may read only the ` +
        `overrides made against it: call overridesAgainstUnit(movements, unit.id) instead. ` +
        `Filtering allOverrides (or a renamed export of it) in the component looks identical in ` +
        `review and leaks every other ward's row the moment somebody adds a column, a debug panel, ` +
        `or a styling change.`,
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

    const offenders = reachable
      .filter((file) => {
        const identifiers = identifiersIn(file);
        return [...FORBIDDEN_REGISTER_READS].some((name) => identifiers.has(name));
      })
      .map(relative);
    expect(
      offenders,
      "a module the ward screen reaches takes the unrestricted read (or a renamed export of it) — route it through overridesAgainstUnit()",
    ).toEqual([]);
  });

  it("catches a default import of the definer under any local name, and leaves an unrelated default import alone", () => {
    // Two DIFFERENT local names, on purpose. A check written only against the obvious spelling
    // would pass its own author's test and miss the one a real leaker would actually choose — the
    // same defect this whole guard exists to prevent, one level down. So the second name is
    // deliberately unhelpful: nothing a person skimming the diff would recognise as suspicious.
    const plausibleName = 'import allOverrides from "../ward-derivations";\nvoid allOverrides;\n';
    const unhelpfulName = 'import zqBinding from "../ward-derivations";\nvoid zqBinding;\n';
    // The control: an ordinary default import of a module that is NOT the definer. A check that
    // reddens every default import anywhere would pass both cases above for the wrong reason.
    const unrelatedDefault = 'import Something from "../ward-sites";\nvoid Something;\n';

    expect(
      defaultImportsOfTheDefiner(plausibleName, WARD_SCREEN),
      "a default import spelled with the obvious name is not detected",
    ).toEqual(["../ward-derivations"]);
    expect(
      defaultImportsOfTheDefiner(unhelpfulName, WARD_SCREEN),
      "a default import under an unhelpful local name is not detected — the check is reading the " +
        "spelling, not the module it resolves to, which is the exact defect this check exists to fix",
    ).toEqual(["../ward-derivations"]);
    expect(
      defaultImportsOfTheDefiner(unrelatedDefault, WARD_SCREEN),
      "an ordinary default import of an unrelated module is being flagged — this check would forbid " +
        "every default import in the codebase, not just the definer's",
    ).toEqual([]);

    // And a named import of the definer — the legitimate `overridesAgainstUnit` read included —
    // must never be mistaken for a default import of it.
    expect(
      defaultImportsOfTheDefiner('import { overridesAgainstUnit } from "../ward-derivations";\n', WARD_SCREEN),
      "a named import of the definer is being read as a default import of it",
    ).toEqual([]);
  });

  it("never lets a module the ward screen reaches take the whole register as a default import, whatever it calls it", () => {
    // THE LIVE CATCH. Runs over the same `wardScreenReaches()` sweep the module-in-between check
    // above uses, so a leak placed in any ward-only module — not only the entry file — is caught.
    const reachable = wardScreenReaches().filter((file) => file !== DEFINES_THE_READS);
    expect(reachable.length, "the ward screen's module graph collapsed — this sweep scans nothing").toBeGreaterThan(5);

    const offenders = reachable
      .flatMap((file) =>
        defaultImportsOfTheDefiner(readFileSync(file, "utf8"), file).map(
          (specifier) => `${relative(file)}: import … from "${specifier}"`,
        ),
      )
      .sort();
    expect(
      offenders,
      "a module the ward screen reaches takes the whole override register as a default import — " +
        "the local name does not matter, only where the specifier resolves. Use " +
        "overridesAgainstUnit(movements, unit.id) instead.",
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
