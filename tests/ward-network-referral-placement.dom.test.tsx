import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-flow-queue-selection.dom.test.tsx: the network workspace renders a next/link
// anchor and this suite never checks routing, so a plain <a> avoids requiring an App Router
// context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { referrals } from "@/components/ward-management/ward-movements";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { parseModuleSource } from "./helpers/module-graph";

const NETWORK_COMPONENT = resolve(process.cwd(), "src/components/ward-management/ward-management-network.tsx");
const D15_CONTRACT_TEST = resolve(process.cwd(), "tests/ward-referral-matching.test.ts");

/** The first referral the coordinator's own queue order puts up — resolved from the seed rather
 *  than named by id, so this suite follows the fixture instead of pinning a spelling of it. */
const SUBJECT = referralQueueOrder(referrals)[0]!;

const VERDICT_TESTID = /^ward-network-verdict-/;

function renderNetwork() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardModeWorkspace mode="network" />
    </WardFlowProvider>,
  );
}

function verdictNodes() {
  return screen.queryAllByTestId(VERDICT_TESTID);
}

function unitIdsCarryingAVerdict() {
  return verdictNodes()
    .map((node) => node.getAttribute("data-testid")!.replace("ward-network-verdict-", ""))
    .sort();
}

/**
 * Phase 8 Task 7 (spec D8-5). The diagram becomes a placement tool: pick a referral, and every
 * unit node carries that referral's own verdict.
 *
 * The load-bearing word is EVERY. The movement path on this same screen deliberately shows three
 * of many (`eligibleCandidatesAmong`, a shortlist decision taken on that screen and untouched
 * here), so the one thing that can silently turn this into a different feature is a truncation
 * that looks like the neighbouring code. The assertion below is therefore a SET EQUALITY against
 * the network's own unit list, not a search for a satisfying example and not a bare count: it
 * fails on a truncation, on a duplicated node, and on a unit dropped from the diagram.
 */
describe("network diagram, referral placement", () => {
  it("carries a verdict on every unit node, never a shortlist of three", () => {
    const units = allUnits();
    // Non-vacuity floor: "every unit, not three" claims nothing on a three-unit network.
    expect(units.length, "the network is too small for 'every unit, not three' to mean anything").toBeGreaterThan(3);

    renderNetwork();

    // No referral is selected on mount, so the diagram is still the movement view and no node
    // carries a verdict. Without this the assertion below could pass on a screen that renders
    // verdicts unconditionally, which would be a different (and wrong) component.
    expect(verdictNodes(), "a verdict was rendered before any referral was selected").toHaveLength(0);

    fireEvent.click(screen.getByTestId(`ward-network-referral-${SUBJECT.id}`));

    expect(unitIdsCarryingAVerdict(), "the units carrying a verdict are not exactly the units in the network").toEqual(
      units.map((unit) => unit.id).sort(),
    );
  });

  /**
   * The companion the invariance above needs. A set equality proves nothing about WHAT each node
   * says — a component rendering one uniform string on every node would satisfy it exactly as
   * well as the real thing. This pins an absolute where the answers should differ: the exact
   * sentence `matchReason` produces for a bed that does not run this referral's age band, spelled
   * out here rather than recomputed, so a change of wording is visible rather than agreed with.
   *
   * `SUBJECT` is Youth (the seed's first queued referral), and `scgh-adult-open` is an Adult unit,
   * so its first failing gate is `age`. The reason text is `ward-eligibility.ts`'s own.
   */
  it("shows each unit the single reason it cannot take this referral", () => {
    renderNetwork();
    fireEvent.click(screen.getByTestId(`ward-network-referral-${SUBJECT.id}`));

    expect(SUBJECT.ageBand, "the seed's first queued referral is no longer the Youth one this pins").toBe("Youth");

    const adultUnit = screen.getByTestId("ward-network-verdict-scgh-adult-open");
    expect(adultUnit).toHaveTextContent("Adult unit does not match a youth referral");
    expect(adultUnit.getAttribute("data-accepts")).toBe("false");

    // And the verdicts are not one uniform string repeated across the network, which is the other
    // way the set equality above could hold while the screen said nothing useful.
    const distinct = new Set(verdictNodes().map((node) => node.textContent));
    expect(distinct.size, "every unit node carried the same verdict text").toBeGreaterThan(1);
  });

  /**
   * Fix round 1, finding 1. The placement aside shipped with three test ids and no assertion
   * against any of them: the whole panel could have been deleted and every other test here stayed
   * green — including this task's own claim that a referral's tier renders as the coordinator's
   * label rather than a bare digit, which had no test at all.
   *
   * Scoped STRUCTURALLY, `within` the aside resolved by its own accessible name, never by a
   * document-wide query. jsdom hides nothing, so "the label is somewhere in the document" would
   * pass just as well with the element moved out of the panel entirely.
   */
  it("names the referral in the aside, with the tier spelled as a label and not a bare digit", () => {
    expect(SUBJECT.urgency, "the seed's first queued referral no longer carries the tier this pins").toBe(2);
    expect(SUBJECT.homeRegion, "the seed's first queued referral no longer carries the facts this pins").toBe(
      "Perth Metropolitan",
    );

    renderNetwork();

    // Before selection the placement panel is not merely empty — it is not the aside on screen.
    expect(screen.queryByRole("complementary", { name: "Referral placement" })).toBeNull();
    expect(screen.getByRole("complementary", { name: "Explainable shortlist" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`ward-network-referral-${SUBJECT.id}`));

    const aside = screen.getByRole("complementary", { name: "Referral placement" });
    expect(
      screen.queryByRole("complementary", { name: "Explainable shortlist" }),
      "both asides were on screen at once — the movement panel did not stand down",
    ).toBeNull();

    // `urgencyTierLabel`'s own output, written out rather than recomputed here: a bare "2" reddens
    // this, which is the whole reason the label exists on a referral surface.
    expect(within(aside).getByTestId("ward-network-placement-tier")).toHaveTextContent("Tier 2 · urgent");
    expect(within(aside).getByTestId("ward-network-placement-facts")).toHaveTextContent(
      "Youth · Female · Perth Metropolitan",
    );
    expect(within(aside).getByTestId("ward-network-placement-note")).toBeInTheDocument();
  });

  it("hands the diagram back to the movement view when the selected referral is deselected", () => {
    renderNetwork();
    const row = screen.getByTestId(`ward-network-referral-${SUBJECT.id}`);

    fireEvent.click(row);
    expect(verdictNodes().length).toBeGreaterThan(0);

    fireEvent.click(row);
    expect(verdictNodes(), "deselecting the referral left its verdicts on the diagram").toHaveLength(0);
  });
});

/**
 * Spec D15, applied to this component. Matching itself must not read the bed-release model at all
 * (`tests/ward-referral-matching.test.ts` holds that over the whole module graph reachable from
 * `ward-eligibility.ts`/`ward-referrals.ts`). This screen is a different case: it ALREADY reads
 * that model for its Confirmed/Predicted chips, which predate this phase. The rule Task 7 works
 * under is therefore narrower and exact — the placement overlay adds no NEW read — so this pins
 * the component's release-model imports to the two that were already there.
 *
 * A ratchet, not a prohibition: it goes red on an added import, and it also goes red if one of the
 * two is removed without this baseline being updated deliberately.
 */
describe("the placement overlay adds no new read of the bed-release model", () => {
  /** The same spellings the D15 contract test enumerates. Asserted identical to it below rather
   *  than trusted to stay in step — a third hand-maintained copy of a guard's vocabulary is how
   *  two guards end up checking different things while both report green. */
  const RELEASE_MODEL_IDENTIFIERS = [
    "BedRelease",
    "BedReleaseState",
    "BedReleaseWaitingOn",
    "BED_RELEASE_STATES",
    "BED_RELEASE_WAITING_ON",
    "releaseBand",
    "RELEASE_BANDS",
    "capacityBreakdown",
  ] as const;

  const RELEASE_MODEL_PATTERN = new RegExp(RELEASE_MODEL_IDENTIFIERS.map((name) => `\\b${name}\\b`).join("|"));

  /**
   * Every identifier this module imports, read from a real parse of the file rather than from a
   * regex over its text. The D15 contract test hand-rolls a comment scanner because it must walk a
   * whole module graph; here one file is enough, so the repository's own Babel parser
   * (`tests/helpers/module-graph.ts`, already used by the architecture and RSC boundary guards)
   * does the job — a comment, a string or a template literal cannot hide an import from it, and a
   * parse failure throws rather than quietly reporting nothing.
   */
  function importedIdentifiers(source: string): string[] {
    const names: string[] = [];
    for (const statement of parseModuleSource(source).program.body) {
      if (statement.type !== "ImportDeclaration") continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type === "ImportSpecifier") {
          names.push(specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value);
        } else {
          names.push(specifier.local.name);
        }
      }
    }
    return names;
  }

  function releaseModelImportsIn(source: string): string[] {
    return [...new Set(importedIdentifiers(source).filter((name) => RELEASE_MODEL_PATTERN.test(name)))].sort();
  }

  it("uses the same identifier set as the D15 contract test, not a copy that has drifted from it", () => {
    const contract = readFileSync(D15_CONTRACT_TEST, "utf8");
    const declared = contract.match(/BED_RELEASE_IDENTIFIER\s*=\s*\/([\s\S]*?)\/;/);
    expect(declared, "BED_RELEASE_IDENTIFIER was not found in the D15 contract test").not.toBeNull();
    expect(declared![1], "this file's release-model vocabulary has drifted from the D15 contract test").toBe(
      RELEASE_MODEL_PATTERN.source,
    );
  });

  it("finds a release-model import and leaves an unrelated one alone", () => {
    // Pins the extractor itself in both directions. Without this, an extractor that found nothing
    // at all would satisfy the ratchet below by agreeing with an empty expectation, and one that
    // matched everything would be indistinguishable from a real finding.
    expect(releaseModelImportsIn('import { releaseBand } from "./ward-distance";')).toEqual(["releaseBand"]);
    expect(releaseModelImportsIn('import { capacityBreakdown } from "./ward-bed-availability";')).toEqual([
      "capacityBreakdown",
    ]);
    expect(releaseModelImportsIn('import { Referral } from "./ward-model";')).toEqual([]);
    // `BedReleaseBlocker` is the owner-approved blocked-reason vocabulary, not a piece of the
    // release model — the D15 contract test enumerates spellings exactly for this reason, and so
    // does this one.
    expect(releaseModelImportsIn('import { BedReleaseBlocker } from "./ward-change-reasons";')).toEqual([]);
  });

  it("imports exactly the two release-model identifiers it already had", () => {
    const source = readFileSync(NETWORK_COMPONENT, "utf8");
    // Non-vacuity floor on the parse: a component that imports almost nothing means the extractor
    // lost the file, and an empty release-model list would then be an absent signal reading as a
    // passing one.
    expect(importedIdentifiers(source).length, "the parse produced too few imports to be this file").toBeGreaterThan(
      15,
    );

    expect(
      releaseModelImportsIn(source),
      "the placement overlay added a read of the bed-release model this component did not already have",
    ).toEqual(["BedRelease", "capacityBreakdown"]);
  });

  /*
   * Fix round 1, finding 2, and the more important half of this contract.
   *
   * The ratchet above inspects IMPORT SPECIFIERS, so all it proves is that no new release-model
   * MODULE is reached. `capacityBreakdown` is already imported — rendering the blocked-discharge
   * figure would need no new import at all, and the ratchet would stay green while the prohibition
   * this phase's central claim rests on was broken. A guard watching the door with the thing it
   * guards against already inside the room.
   *
   * What follows is the READ. Every property taken off a `capacityBreakdown` value in this
   * component, whatever the local variable happens to be called. The permitted set is exactly the
   * two figures the Confirmed and Predicted chips showed before Phase 8 began. `blockedToday` —
   * the blocked-discharge figure, added to the breakdown after this phase's plan was written — and
   * `excludedBeyondToday` are the two that must never appear: surfacing either would grow the
   * phase's only unvalidated-bed-model exposure from two figures to three, and would break the
   * claim that being wrong about that model costs this phase almost nothing.
   *
   * It matters most because step two edits this same file, which is exactly the moment somebody
   * reaches for those numbers for good-looking reasons.
   */

  /** Every property name read off a `capacityBreakdown` value in `source`. A value counts as one
   *  when it is bound from a `capacityBreakdown(...)` call, when its type annotation names
   *  `capacityBreakdown` (how `bedStateValue` receives one), or when the call result is read
   *  directly. Scoped that way rather than by property name, because `unitCapacity` returns a
   *  `held` and a `blocked` of its own and reading those is not a release-model read. */
  function breakdownPropertyReads(source: string): string[] {
    const ast = parseModuleSource(source);
    const bindings = new Set<string>();
    const reads = new Set<string>();

    const isBreakdownCall = (node: Record<string, unknown> | null | undefined) =>
      node?.type === "CallExpression" &&
      (node.callee as Record<string, unknown> | undefined)?.type === "Identifier" &&
      (node.callee as { name?: string }).name === "capacityBreakdown";

    const walk = (node: unknown, visit: (node: Record<string, unknown>) => void) => {
      if (Array.isArray(node)) {
        for (const child of node) walk(child, visit);
        return;
      }
      if (!node || typeof node !== "object" || typeof (node as { type?: unknown }).type !== "string") return;
      visit(node as Record<string, unknown>);
      for (const [key, value] of Object.entries(node)) {
        if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
        walk(value, visit);
      }
    };

    walk(ast.program, (node) => {
      if (node.type === "VariableDeclarator") {
        const id = node.id as { type?: string; name?: string } | undefined;
        if (id?.type === "Identifier" && id.name && isBreakdownCall(node.init as Record<string, unknown>)) {
          bindings.add(id.name);
        }
      }
      // A type annotation naming the function — `ReturnType<typeof capacityBreakdown>` — read from
      // the annotation's own source range, so no assumption is made about its TS node shape.
      if (node.type === "Identifier" && node.typeAnnotation && typeof node.name === "string") {
        const annotation = node.typeAnnotation as { start?: number; end?: number };
        if (typeof annotation.start === "number" && typeof annotation.end === "number") {
          if (source.slice(annotation.start, annotation.end).includes("capacityBreakdown")) bindings.add(node.name);
        }
      }
    });

    walk(ast.program, (node) => {
      if (node.type !== "MemberExpression" || node.computed === true) return;
      const property = node.property as { type?: string; name?: string } | undefined;
      if (property?.type !== "Identifier" || !property.name) return;
      const object = node.object as { type?: string; name?: string } | undefined;
      const fromBinding = object?.type === "Identifier" && object.name !== undefined && bindings.has(object.name);
      if (fromBinding || isBreakdownCall(node.object as Record<string, unknown>)) reads.add(property.name);
    });

    return [...reads].sort();
  }

  it("sees a breakdown read whatever the value is called, and never mistakes a capacity read for one", () => {
    // Pins the detector in both directions before anything is concluded from it. All four positive
    // shapes appear in, or could appear in, the component itself.
    expect(
      breakdownPropertyReads("const breakdown = capacityBreakdown(u, r, l, n); void breakdown.blockedToday;"),
    ).toEqual(["blockedToday"]);
    expect(breakdownPropertyReads("const totals = capacityBreakdown(u, r, l, n); void totals.blockedToday;")).toEqual([
      "blockedToday",
    ]);
    expect(
      breakdownPropertyReads(
        "function f(breakdown: ReturnType<typeof capacityBreakdown>) { return breakdown.excludedBeyondToday; }",
      ),
      "a breakdown received as a typed parameter was invisible to this guard",
    ).toEqual(["excludedBeyondToday"]);
    expect(breakdownPropertyReads("void capacityBreakdown(u, r, l, n).excludedBeyondToday;")).toEqual([
      "excludedBeyondToday",
    ]);

    // And the negative, which is why this is scoped to the value rather than to property names:
    // `unitCapacity` has a `held` and a `blocked` of its own, and this component reads both.
    expect(
      breakdownPropertyReads("const capacity = unitCapacity(u, r); void capacity.held; void capacity.blocked;"),
      "a unitCapacity read was counted as a bed-release read",
    ).toEqual([]);
  });

  it("reads only the two breakdown figures the bed-state chips already showed", () => {
    // The figures are read off the function's OWN return value rather than hand-listed, so a
    // renamed or newly added figure is covered the day it lands rather than the day somebody
    // remembers to add it here.
    const breakdownKeys = Object.keys(capacityBreakdown(allUnits()[0]!, [], [], NOW_ANCHOR));
    expect(breakdownKeys, "the blocked-discharge figure this guard names is no longer in the breakdown").toContain(
      "blockedToday",
    );
    expect(breakdownKeys, "the beyond-today figure this guard names is no longer in the breakdown").toContain(
      "excludedBeyondToday",
    );

    // EXACTLY, never a subset — a detector that found nothing would satisfy a subset check while
    // proving nothing at all.
    expect(
      breakdownPropertyReads(readFileSync(NETWORK_COMPONENT, "utf8")),
      "this component now reads a bed-release figure beyond the two the Confirmed/Predicted chips already showed",
    ).toEqual(["confirmedToday", "predictedToday"]);
  });
});
