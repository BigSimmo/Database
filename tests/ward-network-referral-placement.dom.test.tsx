import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
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
});
