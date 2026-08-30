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

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { wallClockNow } from "@/components/ward-management/ward-clock";
import {
  NOT_RECORDED_LABEL,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  TRAVEL_BAND_LABELS,
  travelBand,
  TRAVEL_BANDS,
  type TravelBand,
} from "@/components/ward-management/ward-distance";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { BAND_ARRANGEMENT_LIMITATION_NOTICE } from "@/components/ward-management/ward-management-network";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { HOME_REGIONS, type HomeRegion, type Referral } from "@/components/ward-management/ward-model";
import { referrals } from "@/components/ward-management/ward-movements";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { allUnits, NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

import { parseModuleSource } from "./helpers/module-graph";

const NETWORK_COMPONENT = resolve(process.cwd(), "src/components/ward-management/ward-management-network.tsx");
const D15_CONTRACT_TEST = resolve(process.cwd(), "tests/ward-referral-matching.test.ts");

/** The first referral the coordinator's own queue order puts up — resolved from the seed rather
 *  than named by id, so this suite follows the fixture instead of pinning a spelling of it. */
const SUBJECT = referralQueueOrder(referrals)[0]!;

const VERDICT_TESTID = /^ward-network-verdict-/;

/**
 * A home region for which at least one travel band holds no unit at all, SEARCHED for in the
 * fixture rather than named — the same discipline `tests/ward-referral-screens.dom.test.tsx` sets
 * for itself, and for the same reason: every value in `SYNTHETIC_TRAVEL_BANDS` is invented, sits
 * beside real hospital names, and nobody has measured one. On the day the placeholders are replaced
 * with checked values this either stays green or fails loudly by name.
 *
 * It exists because neither referral in the live queue has one: both are Perth Metropolitan, for
 * which every band is populated, so the empty-group case cannot be reached from the seed alone.
 * `RaiseAndSelectHarness` below raises a real referral with this region so it can be.
 */
const REGION_WITH_AN_EMPTY_BAND = HOME_REGIONS.find((homeRegion) => {
  const bands = allUnits().map((unit) => travelBand(homeRegion, unit.siteCode));
  return TRAVEL_BANDS.some((band) => !bands.includes(band));
});

/** Every referral id the seed ships with, so a referral this suite raises can be told apart from
 *  them without depending on how the reducer mints an id. */
const SEED_REFERRAL_IDS = new Set(referrals.map((referral) => referral.id));

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

/**
 * Phase 8, Task 8 (spec D11, step 3). The diagram arranges every unit by how far it is from where
 * the selected referral's person lives — and draws no arrangement at all for a movement.
 *
 * The two properties below are the ones that can silently invert. "Present for a referral" is easy
 * and would pass on a screen that drew the arrangement unconditionally, which is why the absence
 * half is asserted in the same test and why the mutation named in the comment is the one that has
 * to redden it.
 */
describe("network diagram, the travel-band arrangement", () => {
  /** Written out rather than derived from `TRAVEL_BANDS`: a count compared against the list it came
   *  from could not fail. Adding or removing a band is then a decision somebody takes in a test.
   *  It counts groups on a screen and is not a clinical, legal or measured figure. */
  const EXPECTED_BAND_GROUP_COUNT = 5;

  /** The heading a coordinator reads for a group key, taken from the exported label maps and never
   *  through `travelBandGroupLabel` — an expectation computed by calling the very function the
   *  screen calls would move with it, so a screen labelling groups by something else entirely would
   *  still agree with its own expectation. */
  const bandHeadingFor = (band: string) =>
    band === "not_recorded" ? NOT_RECORDED_LABEL : TRAVEL_BAND_LABELS[band as TravelBand];

  /**
   * The grouping a screen actually rendered: each group in DOM order, with the unit ids inside it in
   * DOM order.
   *
   * Read with `querySelectorAll` rather than a role query on purpose. This runs over BOTH screens,
   * and the match view's groups are still `<details>` that mount SHUT here (jsdom's stubbed
   * `matchMedia` reports no match); a role query would quietly return nothing for those and turn a
   * completeness assertion into a vacuous one on exactly one side of the comparison. The diagram's
   * own groups no longer fold at all — see `NetworkBandGroup` — but the two sides must be read the
   * same way for their equality to mean anything.
   */
  function groupingIn(root: HTMLElement, groupPrefix: string, itemPrefix: string) {
    return Array.from(root.querySelectorAll(`[data-testid^="${groupPrefix}"]`)).map((group) => ({
      band: (group.getAttribute("data-testid") ?? "").slice(groupPrefix.length),
      unitIds: Array.from(group.querySelectorAll(`[data-testid^="${itemPrefix}"]`)).map((node) =>
        (node.getAttribute("data-testid") ?? "").slice(itemPrefix.length),
      ),
    }));
  }

  const diagramGrouping = (root: HTMLElement) => groupingIn(root, "ward-network-band-group-", "ward-network-card-");
  const matchGrouping = (root: HTMLElement) =>
    groupingIn(root, "ward-referral-match-band-group-", "ward-referral-match-row-");

  /** `ReferralMatchView` takes its referral and units as explicit props, so this harness can hand it
   *  exactly the inputs the diagram is working from — the same seed referral, the same site table,
   *  the same clock — and any difference in grouping is then the screens disagreeing, never the
   *  inputs differing. */
  function MatchHarness({ referral }: { referral: Referral }) {
    const { now, dispatch, rejections } = useWardFlow();
    return (
      <ReferralMatchView referral={referral} units={allUnits()} now={now} dispatch={dispatch} rejections={rejections} />
    );
  }

  /**
   * Raises a real referral through the reducer (`RECEIVE_REFERRAL`, so it genuinely resolves in
   * `state.referrals` and reaches the diagram's own queue) and renders the network workspace beside
   * it. `originSiteCode` is taken from the site table and is deliberately unrelated to `homeRegion`:
   * where somebody presents is not where they live, which is the distinction this whole phase turns
   * on, and only `homeRegion` reaches a band.
   */
  function RaiseAndSelectHarness({ homeRegion }: { homeRegion: HomeRegion }) {
    const { referrals: live, now, dispatch } = useWardFlow();
    const raised = live.find((referral) => !SEED_REFERRAL_IDS.has(referral.id));
    return (
      <>
        <button
          type="button"
          data-testid="raise-band-test-referral"
          onClick={() =>
            dispatch({
              type: "RECEIVE_REFERRAL",
              role: "community",
              now,
              ageBand: "Adult",
              destination: {
                kind: "psychiatric_ward",
                sex: "Female",
                secureBedNeeded: false,
                involuntaryBedNeeded: false,
              },
              homeRegion,
              source: "community",
              urgency: 2,
              originSiteCode: allUnits()[0]!.siteCode,
              transportNeeded: false,
            })
          }
        >
          Raise
        </button>
        <span data-testid="raised-referral-id">{raised?.id ?? ""}</span>
        <WardModeWorkspace mode="network" />
      </>
    );
  }

  function renderMatchFor(referral: Referral) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchHarness referral={referral} />
      </WardFlowProvider>,
    );
  }

  /*
   * MUTATION that must redden this test, and the reason it is the one worth running:
   *
   *     const bandSubject: Referral | null = selectedReferral;
   *   → const bandSubject: Referral | null =
   *       selectedReferral ?? ({ ...referralQueue[0], homeRegion: movementHealthService(patient) } as unknown as Referral);
   *
   * That is the "Nearest candidates" mistake in a new coat. A `Movement` has no home region at all —
   * it has an origin emergency department, which is where the person presented — so the only way to
   * arrange for one is to substitute something about the ORIGIN SITE for where they live. WF-018 sat
   * in SCGH's own emergency department and was offered RPH first under that heading, in an order that
   * was merely the array's order. An arrangement drawn from an origin is that same claim with no fact
   * behind it, and this test is what stands between the screen and it.
   */
  it("arranges by band for a referral, and draws no arrangement at all for a movement", () => {
    const { container } = renderNetwork();

    // A movement is the subject on mount. Nothing about distance is drawn, and the service-column
    // layout is what is standing.
    expect(
      within(container).queryByTestId("ward-network-band-arrangement"),
      "a band arrangement was drawn while a movement was the diagram's subject",
    ).toBeNull();
    expect(within(container).queryAllByTestId(/^ward-network-band-group-/)).toHaveLength(0);
    expect(container.querySelector('[data-layout="services"]')).not.toBeNull();
    expect(container.querySelector('[data-layout="bands"]')).toBeNull();

    fireEvent.click(screen.getByTestId(`ward-network-referral-${SUBJECT.id}`));

    expect(within(container).getByTestId("ward-network-band-arrangement")).toBeInTheDocument();
    expect(within(container).getAllByTestId(/^ward-network-band-group-/)).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    expect(container.querySelector('[data-layout="bands"]')).not.toBeNull();
    expect(container.querySelector('[data-layout="services"]')).toBeNull();

    // Deselecting hands the diagram back, arrangement and all — so the absence above is a live
    // property of movement mode rather than only of the first paint.
    fireEvent.click(screen.getByTestId(`ward-network-referral-${SUBJECT.id}`));
    expect(
      within(container).queryByTestId("ward-network-band-arrangement"),
      "deselecting the referral left its band arrangement on the diagram",
    ).toBeNull();
  });

  /*
   * MUTATION that must redden this test:
   *
   *     () => (bandSubject ? groupCandidatesByTravelBand(bandSubject, placements) : []),
   *   → () => (bandSubject ? [...groupCandidatesByTravelBand(bandSubject, placements)].reverse() : []),
   *
   * A diagram and a match view that group one referral's beds two different ways is the Phase 5
   * defect exactly: one screen answering a question two ways, with nothing on either screen to say
   * which answer is the intended one.
   */
  it("groups the same referral the same way the match view does — band order and contents alike", () => {
    const units = allUnits();
    // Non-vacuity floor. Two lists that agree prove nothing if both are empty, and a comparison over
    // one populated band could not see a reordering inside it.
    expect(units.length, "the network is too small for this comparison to mean anything").toBeGreaterThan(3);

    const diagram = renderNetwork();
    fireEvent.click(within(diagram.container).getByTestId(`ward-network-referral-${SUBJECT.id}`));
    const fromDiagram = diagramGrouping(diagram.container);

    const match = renderMatchFor(SUBJECT);
    const fromMatch = matchGrouping(match.container);

    // Both screens really did render the whole network, grouped, before either is compared with the
    // other — otherwise two screens that had both lost their list would agree perfectly.
    expect(fromDiagram).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    expect(fromMatch).toHaveLength(EXPECTED_BAND_GROUP_COUNT);
    expect(fromDiagram.flatMap((group) => group.unitIds)).toHaveLength(units.length);
    expect(fromMatch.flatMap((group) => group.unitIds)).toHaveLength(units.length);
    expect(
      fromDiagram.filter((group) => group.unitIds.length > 0).length,
      "every unit landed in one band, so a reordering of the groups could not be seen",
    ).toBeGreaterThan(1);

    expect(fromDiagram, "the diagram and the match view grouped one referral's beds differently").toEqual(fromMatch);
  });

  /*
   * MUTATION that must redden this test: move the `.bandCounts` span out of the `<header>` in
   * `NetworkBandGroup`, leaving it as the group's first body element.
   *
   * These groups no longer fold — the owner ruled that out on 2026-08-29 — so this is no longer a
   * claim about what a shut disclosure still paints. It is now the plainer claim that every band's
   * heading and BOTH its counts sit in the group's own header rather than loose among the unit
   * nodes, which is what keeps "there is nothing within an hour" answerable at a glance. It stays
   * STRUCTURAL rather than a document-wide query for the same reason as before: "the counts are
   * somewhere in the document" would pass with them moved anywhere at all.
   *
   * The removed assertion this replaces counted groups whose `open` property was falsy. Once the
   * element stopped being a `<details>` that property reads `undefined` on every group, so the count
   * would still have been five and the assertion would have gone on passing while proving nothing.
   */
  it("keeps every band heading and both its counts in the group's own header", () => {
    // Deliberately NOT `SUBJECT`: every band is populated for both queued referrals, so neither can
    // exercise the empty-group case — and an empty group still carrying its heading and both counts
    // is the half of the owner's counts decision that a populated screen cannot demonstrate.
    expect(
      REGION_WITH_AN_EMPTY_BAND,
      "no home region leaves a travel band empty, so the empty-group case cannot be exercised here",
    ).toBeDefined();

    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaiseAndSelectHarness homeRegion={REGION_WITH_AN_EMPTY_BAND!} />
      </WardFlowProvider>,
    );
    fireEvent.click(within(container).getByTestId("raise-band-test-referral"));
    const raisedId = within(container).getByTestId("raised-referral-id").textContent ?? "";
    expect(raisedId, "the harness raised no referral the reducer accepted").not.toBe("");
    fireEvent.click(within(container).getByTestId(`ward-network-referral-${raisedId}`));

    const groups = within(container).getAllByTestId(/^ward-network-band-group-/);
    expect(groups).toHaveLength(EXPECTED_BAND_GROUP_COUNT);

    // Nothing on this screen is a disclosure any more, and that is asserted rather than assumed —
    // a `<details>` left behind here would take these groups back to folding wards away.
    expect(
      container.querySelectorAll("details, summary"),
      "a disclosure element is back on the diagram, so a band group can fold wards out of the picture",
    ).toHaveLength(0);

    let emptyGroups = 0;
    for (const group of groups) {
      const band = (group.getAttribute("data-testid") ?? "").replace("ward-network-band-group-", "");
      // The group's own header, resolved by its test id rather than by tag, so this cannot silently
      // start matching some other element the group happens to contain.
      const header = within(group).getByTestId(`ward-network-band-header-${band}`);

      // Scoped `within(header)`, never `within(group)` and never document-wide: the whole claim is
      // about which part of the group they sit in.
      const counts = within(header).getByTestId(`ward-network-band-counts-${band}`);
      expect(counts.textContent ?? "").toMatch(/in this band/);
      expect(within(header).getByText(bandHeadingFor(band))).toBeInTheDocument();

      if (within(group).queryByTestId(`ward-network-band-empty-${band}`)) emptyGroups += 1;
    }

    // And an empty group is one of the cases just checked, not an exception to it. Without this the
    // loop above could hold while empty groups were dropped from the screen entirely.
    expect(emptyGroups, "no band group was empty, so the empty case above was never exercised").toBeGreaterThan(0);
  });

  /*
   * MUTATION that must redden this test: render a second copy of the
   * `ward-network-synthetic-notice` paragraph inside the arrangement.
   *
   * "Once" is the property worth guarding. A band shown without that sentence on the same screen is
   * a defect; a sentence repeated per group is how a screen stops being read at all.
   */
  it("states once that the travel times are invented, and states what this picture is not", () => {
    const { container } = renderNetwork();
    fireEvent.click(within(container).getByTestId(`ward-network-referral-${SUBJECT.id}`));

    const notices = within(container).getAllByTestId("ward-network-synthetic-notice");
    expect(notices).toHaveLength(1);
    // The imported sentence, never a retyped one.
    expect(notices[0].textContent).toBe(SYNTHETIC_TRAVEL_TIMES_NOTICE);

    const arrangement = within(container).getByTestId("ward-network-band-arrangement");
    // Counted over the WHOLE rendered screen, not just the arrangement: "once" is a property of the
    // screen a coordinator reads, and a second copy placed in the aside or the legend would be
    // invisible to a sweep scoped to the groups.
    const occurrences = (container.textContent ?? "").split(SYNTHETIC_TRAVEL_TIMES_NOTICE).length - 1;
    expect(occurrences, "the invented-travel-times sentence does not appear exactly once on this screen").toBe(1);

    // The screen says what this picture is not, and that it is less than it was meant to be.
    const limitation = within(container).getByTestId("ward-network-band-limitation");
    expect(limitation.textContent).toBe(BAND_ARRANGEMENT_LIMITATION_NOTICE);
    expect(limitation.textContent ?? "").toMatch(/not a map/);
    expect(limitation.textContent ?? "").toMatch(/less than/);

    // No comparative proximity word anywhere on the SCREEN — not in a heading, not in a count, not in
    // either notice, and not in the panels around them. The standing rule covers the whole screen,
    // and a sweep scoped to the arrangement was narrower than the rule it claimed to enforce. Air
    // transport only is a statement about how you get there, never about how long it takes.
    const comparative = /nearest|closest|furthest|most remote|hardest to reach|best|optimal|recommend|preferred/i;
    // Positive control, so a regex that had stopped matching anything could not read as a clean
    // sweep.
    expect("the nearest bed is best", "the comparative-word pattern no longer matches one").toMatch(comparative);

    /*
     * ONE CONTROL PER ARM — Phase 8, whole-branch review, W2.
     *
     * The single control above exercises exactly TWO of the nine alternatives in `comparative`
     * (`nearest` and `best`). A typo in any of the other seven would leave that arm silently inert
     * while the control and both sweeps below stayed green: a check reporting a clean result having
     * tested two ninths of what it claims. This is structurally the SAME defect item 17 closed on
     * the six-arm second-clock guard further down this same file, and the stakes are higher here —
     * the no-comparative-word rule is a standing clinical constraint on what a bed-finding screen
     * may say, and the two whole-screen sweeps below are its only automated enforcement on this
     * screen. Closed the same way item 17 closed that one: by STRENGTHENING. Nothing above is
     * removed and nothing is loosened.
     *
     * Each entry pairs one arm with a snippet of the way that word would plausibly reach this
     * screen. The snippet is matched against ITS OWN arm rather than against the composite,
     * deliberately: a control another arm can satisfy proves nothing about its own, which is
     * exactly the fake this item exists to remove. The `i` flag lives on the composite, so each
     * per-arm regex is written without one and every control is lower-case, which also keeps
     * `arm.source` byte-identical to the composite's own alternative for the equality pin below.
     */
    const COMPARATIVE_ARMS = [
      { arm: /nearest/, control: "the nearest bed" },
      { arm: /closest/, control: "the closest unit" },
      { arm: /furthest/, control: "the furthest ward from home" },
      { arm: /most remote/, control: "the most remote option" },
      { arm: /hardest to reach/, control: "the hardest to reach unit" },
      { arm: /best/, control: "the best available bed" },
      { arm: /optimal/, control: "the optimal placement" },
      { arm: /recommend/, control: "we recommend this unit" },
      { arm: /preferred/, control: "the preferred destination" },
    ] as const;
    // A floor on the sweep itself: a list that lost entries would otherwise control fewer arms
    // while every remaining assertion still passed.
    expect(COMPARATIVE_ARMS, "the comparative control list no longer covers every arm").toHaveLength(9);
    for (const { arm, control } of COMPARATIVE_ARMS) {
      expect(control, `the comparative-word pattern's ${arm.source} arm matches nothing`).toMatch(arm);
    }
    /*
     * And the composite the sweeps actually use carries EXACTLY these arms, in this order.
     *
     * An exact pin rather than a `toContain` per arm, because containment survives the commonest
     * corruption there is: an arm that merely GAINS characters still contains its own name, so
     * `optimal` becoming `optimalXX` would leave a containment assertion green while that arm
     * matches nothing real. Equality catches an arm renamed, dropped, added, reordered OR extended,
     * and its two sides are separate literals a few lines apart, so it can genuinely fail. The
     * message names both lists rather than saying only that they differ, so two different corrupted
     * arms cannot produce a byte-identical failure line.
     */
    const comparativeGuardArms = comparative.source.split("|");
    const comparativeControlledArms = COMPARATIVE_ARMS.map(({ arm }) => arm.source);
    expect(
      comparativeGuardArms,
      `the comparative-word guard's arms are no longer exactly the arms controlled above, so one of them is unguarded or uncontrolled — guard carries [${comparativeGuardArms.join(", ")}], controls cover [${comparativeControlledArms.join(", ")}]`,
    ).toEqual(comparativeControlledArms);

    expect(arrangement.textContent ?? "").not.toMatch(comparative);
    expect(container.textContent ?? "", "a comparative proximity word is on this screen").not.toMatch(comparative);

    // And the same screen with the referral deselected, so the sweep covers the movement view's own
    // panels — the compare table, its labels and the connector legend keys — rather than only the
    // half of the screen this task built. Both halves are clean today; `tests/ward-management.test.ts`
    // separately pins the two `originServiceFit` labels, one of which read "Best" until Task 6.
    fireEvent.click(within(container).getByTestId(`ward-network-referral-${SUBJECT.id}`));
    expect(
      container.textContent ?? "",
      "a comparative proximity word is on the movement view of this screen",
    ).not.toMatch(comparative);
  });
});

/**
 * Phase 8, Task 9 (spec D11, step 4). The whole-network overview, now that placement is the primary
 * job this screen does.
 *
 * The overview is what is left over when nobody is being placed — it is subordinate, and it is not
 * removed. Everything below is a guard over what the overview must go on being while it is the
 * secondary picture, because the ways it could quietly stop being that all look like tidying:
 *
 *  - **Every unit, always.** A ward that vanishes from the whole-network overview reads as "no such
 *    bed exists". That is the worst thing a bed-finding screen can say, and on this screen it would
 *    arrive through layout rather than through any claim about distance — a service list that drifted
 *    from the model, or a picture narrowed to the units something happened to route to.
 *  - **Reachable.** Secondary must mean "the other picture", never "the picture you can no longer
 *    get back to".
 *  - **Routing decorates it and does not arrange it.** Line weight is roadmap 14's own commitment and
 *    it survives here, subordinate: the connector lines say which units the selected movement is
 *    shortlisted for, and they must never become an ordering of the picture. An overview that put the
 *    routed wards first would be a ranking nobody decided to build.
 *  - **One clock.** The time control is roadmap 14's too, it lives in the ward shell's own sidebar,
 *    and it drives the shared `now` through the reducer. A second clock here would let two screens
 *    disagree about the same moment silently, and one eligibility gate is time-dependent.
 */
describe("network diagram, the whole-network overview", () => {
  const CARD_PREFIX = "ward-network-card-";

  /** The overview's unit nodes in DOM order — order included on purpose, because two of the claims
   *  below are about arrangement rather than membership. */
  function overviewUnitIdsInOrder(root: HTMLElement) {
    return Array.from(root.querySelectorAll(`[data-testid^="${CARD_PREFIX}"]`)).map((node) =>
      (node.getAttribute("data-testid") ?? "").slice(CARD_PREFIX.length),
    );
  }

  /** The units the selected movement's shortlist draws a route to, sorted — a set, because which
   *  units are routed is the fact, and their order is the thing being proved independent of it. */
  function routedUnitIds(root: HTMLElement) {
    return Array.from(root.querySelectorAll(`[data-testid^="${CARD_PREFIX}"][data-routed="true"]`))
      .map((node) => (node.getAttribute("data-testid") ?? "").slice(CARD_PREFIX.length))
      .sort();
  }

  const sortedUnitIds = () =>
    allUnits()
      .map((unit) => unit.id)
      .sort();

  /*
   * MUTATION that must redden this test — the one the brief names, because it is the shape of the
   * defect rather than a random break:
   *
   *     {units
   *       .filter((unit) => siteByCode(unit.siteCode)?.service === service)
   *   → {units
   *       .filter((unit) => routedIds.has(unit.id))
   *       .filter((unit) => siteByCode(unit.siteCode)?.service === service)
   *
   * A picture narrowed to the wards something happened to route to looks tidier and says something
   * false: every ward it dropped is a real bed, and its absence reads as there being none.
   *
   * SECOND MUTATION, for the order pin below — sort each cluster by free beds:
   *
   *     {units
   *       .filter((unit) => siteByCode(unit.siteCode)?.service === service)
   *   → {units
   *       .filter((unit) => siteByCode(unit.siteCode)?.service === service)
   *       .slice()
   *       .sort((a, b) => b.allocatable.value - a.allocatable.value)
   *
   * Nothing is hidden, every ward is still drawn, and the arrangement is the SAME for every
   * movement — so the completeness assertion and the movement-to-movement invariance test both go
   * on passing. It is a ranking all the same, and the pin below is the only thing that sees it.
   */
  it("renders every unit in the network, not only the ones a route is drawn to", () => {
    const units = allUnits();
    // Non-vacuity floor: "every unit" claims very little on a three-unit network.
    expect(units.length, "the network is too small for 'every unit' to mean anything").toBeGreaterThan(3);

    const { container } = renderNetwork();

    // A movement is the subject on mount, so the overview is the picture standing on the canvas.
    // Without this the assertions below could be satisfied by some other layout's cards.
    expect(
      container.querySelector('[data-layout="services"]'),
      "the overview is not the picture on the canvas when no referral is selected",
    ).not.toBeNull();

    const rendered = overviewUnitIdsInOrder(container);
    // A SET EQUALITY, never a count and never a search for a satisfying example: it fails on a
    // narrowed picture, on a duplicated node, and on a single unit dropped from the site table.
    expect([...rendered].sort(), "the overview's unit nodes are not exactly the units in the network").toEqual(
      sortedUnitIds(),
    );
    expect(rendered, "a unit is drawn on the overview more than once").toHaveLength(units.length);

    /*
     * The ABSOLUTE PIN the two guards around this one need.
     *
     * Membership and invariance between them still leave the overview free to be arranged any way
     * at all, as long as it is arranged that way consistently: sort it by free beds and the set
     * equality above is untouched, the movement-to-movement invariance below is untouched, and
     * every other test on this branch passes while the top of each cluster silently reads as the
     * answer to a question nobody asked here. Uniformly wrong is still uniform.
     *
     * So this pins the one thing those two cannot: the order on the screen IS the model's own
     * order, column by column. The columns are written out here rather than imported from the
     * component — an expectation computed from the very constant the screen renders from would
     * move with it, and a layout change should be a decision somebody takes in a test rather than
     * one a test agrees with silently.
     */
    const OVERVIEW_COLUMNS: readonly (readonly string[])[] = [
      ["North Metro", "WACHS"],
      ["East Metro", "South Metro", "Private"],
    ];
    const modelOrder = OVERVIEW_COLUMNS.flatMap((column) =>
      column.flatMap((service) =>
        units.filter((unit) => siteByCode(unit.siteCode)?.service === service).map((unit) => unit.id),
      ),
    );
    // The pin itself must not be able to go vacuous: a column list that had fallen behind the model
    // would quietly stop covering some units, and comparing two short lists that agree proves
    // nothing about the ones neither of them holds.
    expect(modelOrder, "the pinned column layout no longer covers every unit in the network").toHaveLength(
      units.length,
    );
    expect(rendered, "the overview's units are not in the model's own order, column by column").toEqual(modelOrder);

    // The routed split is populated on BOTH sides. Without this the mutation above could not bite:
    // if every unit were routed, dropping the unrouted ones would change nothing and this test would
    // read as a guard while guarding nothing.
    const routed = routedUnitIds(container);
    expect(routed.length, "no unit is routed, so a picture narrowed to the routed ones would be empty").toBeGreaterThan(
      0,
    );
    expect(
      routed.length,
      "every unit is routed, so a picture narrowed to the routed ones would be identical",
    ).toBeLessThan(units.length);
  });

  /*
   * MUTATION that must redden this test:
   *
   *     setSelectedReferralId((current) => (current === referral.id ? null : referral.id));
   *   → setSelectedReferralId(referral.id);
   *
   * That is the version of "placement is primary" that goes one step too far: once a referral has
   * taken the diagram there is no way back to the whole network, and the secondary picture has been
   * removed rather than subordinated.
   */
  it("stays reachable once a referral has taken the diagram, and comes back whole", () => {
    const { container } = renderNetwork();

    const before = overviewUnitIdsInOrder(container);
    expect(before, "the overview drew no units to begin with").toHaveLength(allUnits().length);

    fireEvent.click(within(container).getByTestId(`ward-network-referral-${SUBJECT.id}`));
    // Placement takes the canvas rather than sharing it — the two pictures draw the same nodes, so
    // both at once would put every unit on the screen twice.
    expect(container.querySelector('[data-layout="bands"]')).not.toBeNull();
    expect(
      container.querySelector('[data-layout="services"]'),
      "both pictures are on the canvas at once, so every unit is drawn twice",
    ).toBeNull();

    fireEvent.click(within(container).getByTestId(`ward-network-referral-${SUBJECT.id}`));
    expect(
      container.querySelector('[data-layout="services"]'),
      "the overview is not reachable once a referral has taken the diagram",
    ).not.toBeNull();

    const after = overviewUnitIdsInOrder(container);
    expect([...after].sort(), "the overview came back missing units").toEqual(sortedUnitIds());
    // Order too, not only membership: an overview that came back rearranged is a different picture
    // from the one the coordinator left.
    expect(after, "the overview came back in a different order from the one it left in").toEqual(before);
  });

  /*
   * MUTATION that must redden this test: order each cluster's units routed-first, in
   * `WardNetworkWorkspace`'s service-column branch —
   *
   *     {units
   *       .filter((unit) => siteByCode(unit.siteCode)?.service === service)
   *       .map((unit) => (
   *   → {units
   *       .filter((unit) => siteByCode(unit.siteCode)?.service === service)
   *       .slice()
   *       .sort((a, b) => Number(routedIds.has(b.id)) - Number(routedIds.has(a.id)))
   *       .map((unit) => (
   *
   * Nothing is hidden by that and every unit is still drawn, which is exactly why the completeness
   * test above cannot see it. It is a ranking all the same: the overview would be arranged by which
   * beds one selected movement happens to be shortlisted for, and the top of each cluster would read
   * as the answer to a question nobody asked here.
   */
  it("lets the selected movement's routing decorate the overview and never arrange it", () => {
    const { container } = renderNetwork();

    const firstOrder = overviewUnitIdsInOrder(container);
    const firstRouted = routedUnitIds(container);

    const queueRows = Array.from(container.querySelectorAll('[data-testid^="ward-network-queue-"]'));
    expect(queueRows.length, "the movement queue holds fewer than two movements to compare").toBeGreaterThan(1);

    // Searched rather than named: this needs two movements whose routed SETS differ, and which
    // movements those are is a property of the seed rather than something to pin a spelling of. If
    // the routed set never changed, "the order did not change either" would be trivially true.
    let secondOrder: string[] | null = null;
    for (const row of queueRows) {
      fireEvent.click(row);
      if (routedUnitIds(container).join("|") !== firstRouted.join("|")) {
        secondOrder = overviewUnitIdsInOrder(container);
        break;
      }
    }

    expect(
      secondOrder,
      "no movement in the queue routes to a different set of units, so a routing-ordered overview would be invisible here",
    ).not.toBeNull();
    expect(secondOrder, "selecting a different movement rearranged the overview").toEqual(firstOrder);
  });

  /*
   * MUTATION that must redden this test: give the network its own clock, e.g. add
   *
   *     const ownClock = Date.now();
   *
   * inside `WardNetworkWorkspace`. Two screens reading two clocks disagree about the same moment
   * without either looking wrong, and `referralEligibility`'s capacity-freshness gate is
   * time-dependent, so the disagreement would reach a verdict about a bed.
   */
  it("reads the one Ward Flow clock and holds none of its own", () => {
    function AdvanceSharedClockHarness() {
      const { now, dispatch } = useWardFlow();
      return (
        <>
          <button
            type="button"
            data-testid="advance-shared-clock"
            onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 60 })}
          >
            Advance
          </button>
          <WardModeWorkspace mode="network" />
        </>
      );
    }

    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceSharedClockHarness />
      </WardFlowProvider>,
    );

    // The shared clock is moved through the reducer, exactly as the ward shell's own time control
    // moves it — never by re-rendering this screen with a different prop, which would prove only
    // that the component re-renders.
    const queueRow = () => container.querySelector('[data-testid^="ward-network-queue-"]');
    const before = queueRow()?.textContent ?? "";
    expect(before, "the overview drew no movement rows, so there is no clock-derived text to read").not.toBe("");

    fireEvent.click(within(container).getByTestId("advance-shared-clock"));
    expect(queueRow()?.textContent ?? "", "the overview did not follow the one Ward Flow clock").not.toBe(before);

    // And the component holds no clock of its own to disagree with it. A source read rather than a
    // behavioural one because a second clock that happened to agree today would be invisible on the
    // screen and would drift the moment the shared one moved. The character class is deliberate:
    // this file has had a backslash escape turn into a literal control byte three times this phase.
    const secondClock = /ADVANCE_CLOCK|RESET_SCENARIO|SET_SCENARIO|Date[.]now|new Date|wallClockNow/;
    // Positive control, so a pattern that had stopped matching anything could not read as clean.
    expect("const ownClock = Date.now();", "the second-clock pattern no longer matches one").toMatch(secondClock);

    /*
     * ONE CONTROL PER ARM — Phase 8, Task 10, item 17.
     *
     * The single control above exercises exactly ONE of the six alternatives in `secondClock`. A
     * typo in any of the other five would leave that arm silently inert while both the control and
     * the guard stayed green: a check reporting a clean result having tested a sixth of what it
     * claims. That is the fifth check-that-cannot-fail found in this phase and the only one caught
     * before it bit, so it is closed by STRENGTHENING — nothing above is removed, nothing loosened.
     *
     * Each entry pairs one arm with a snippet of the way that clock would plausibly be written into
     * this component. The snippet is matched against ITS OWN arm rather than against the composite,
     * deliberately: "RESET_SCENARIO" contains "SET_SCENARIO" as a substring, so a RESET_SCENARIO
     * control checked against the composite would be satisfied through the SET_SCENARIO arm and
     * would prove nothing about its own. A control another arm can satisfy is exactly the fake this
     * item exists to remove.
     *
     * The second assertion then pins each arm INTO the composite the guard actually uses. Its two
     * sides are separate literals — this list, and the regex a few lines above — so it goes red when
     * one is edited without the other, which is the only way an arm can quietly leave the guard.
     */
    const SECOND_CLOCK_ARMS = [
      { arm: /ADVANCE_CLOCK/, control: 'dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 60 });' },
      { arm: /RESET_SCENARIO/, control: 'dispatch({ type: "RESET_SCENARIO", role: "demo", now });' },
      { arm: /SET_SCENARIO/, control: 'dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: "calm" });' },
      { arm: /Date[.]now/, control: "const ownClock = Date.now();" },
      { arm: /new Date/, control: "const ownClock = new Date().getTime();" },
      { arm: /wallClockNow/, control: "const ownClock = wallClockNow();" },
    ] as const;
    // A floor on the sweep itself: a list that lost entries would otherwise control fewer arms while
    // every remaining assertion still passed.
    expect(SECOND_CLOCK_ARMS, "the per-arm control list no longer covers every arm").toHaveLength(6);
    /*
     * ANCHORED TO THE REAL VOCABULARY — Phase 8, Task 10 fix round (F5).
     *
     * Both sides of every assertion around this one are hand-written inside this file, so the whole
     * item-17 rework closed regex TYPOS and left VOCABULARY DRIFT wide open: rename an action in
     * the reducer and the arm stops describing anything real while the control, the length floor
     * and the equality pin all stay green — a guard reporting clean about a clock that no longer
     * has that name.
     *
     * The vocabulary exists in the repository, so one side is read from it rather than retyped.
     * `EVENT_ROLE` is the reducer's own role table and is `Record<WardFlowEvent["type"], ...>`, so
     * adding an event without an entry is a compile error; the three events only the `demo` role
     * may dispatch ARE the clock-and-scenario events this guard is about. `wallClockNow.name` is
     * the exported function's own name, which follows the export through a rename.
     *
     * Deliberately NOT anchored: `Date.now` and `new Date` are platform spellings, not this
     * repository's vocabulary, and there is nothing here for them to drift against.
     */
    const demoOnlyEventTypes = Object.entries(EVENT_ROLE)
      .filter(([, roles]) => roles.length === 1 && roles[0] === "demo")
      .map(([type]) => type)
      .sort();
    expect(
      SECOND_CLOCK_ARMS.map(({ arm }) => arm.source)
        .filter((source) => demoOnlyEventTypes.some((type) => type === source))
        .sort(),
      `the second-clock controls no longer name the reducer's own demo-only events — the reducer declares [${demoOnlyEventTypes.join(", ")}]`,
    ).toEqual(demoOnlyEventTypes);
    expect(
      SECOND_CLOCK_ARMS.map(({ arm }) => arm.source),
      "the second-clock controls no longer name the clock helper `ward-clock.ts` actually exports",
    ).toContain(wallClockNow.name);
    for (const { arm, control } of SECOND_CLOCK_ARMS) {
      expect(control, `the second-clock pattern's ${arm.source} arm matches nothing`).toMatch(arm);
    }
    /*
     * And the composite the guard actually uses carries EXACTLY these arms, in this order.
     *
     * An exact pin rather than a `toContain` per arm, because containment survives the commonest
     * corruption there is: an arm that merely GAINS characters still contains its own name, so
     * `wallClockNow` becoming `wallClockNowXX` leaves a containment assertion green while that arm
     * matches nothing real. Not hypothetical — that was the first mutation tried against this
     * strengthening in Task 10, it did not bite, and this assertion is the rework. Equality catches
     * an arm renamed, dropped, added, reordered OR extended, and its two sides are separate literals
     * a few lines apart, so it can genuinely fail.
     */
    const guardArms = secondClock.source.split("|");
    const controlledArms = SECOND_CLOCK_ARMS.map(({ arm }) => arm.source);
    /* The message names both lists rather than saying only that they differ. Two different arms
     * corrupted must not produce the same failure line: byte-identical failures across different
     * mutations are indistinguishable from a contaminated run, which is a rule this project already
     * has because it has already been caught out by one. */
    expect(
      guardArms,
      `the second-clock guard's arms are no longer exactly the arms controlled above, so one of them is unguarded or uncontrolled — guard carries [${guardArms.join(", ")}], controls cover [${controlledArms.join(", ")}]`,
    ).toEqual(controlledArms);

    expect(
      readFileSync(NETWORK_COMPONENT, "utf8"),
      "the network diagram has a clock of its own, so two screens can disagree about the same moment",
    ).not.toMatch(secondClock);
  });
});
