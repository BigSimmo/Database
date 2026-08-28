import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { WARD_VIEWS } from "@/components/ward-management/ward-nav";

import { originServiceFit } from "@/components/ward-management/ward-management-network";

import { elapsedLabel, movementHealthService } from "../src/components/ward-management/ward-derivations";
import { legalFormName } from "../src/components/ward-management/ward-legal-forms";
import { MOVEMENT_STAGES, PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";
import { movementById, wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits, siteByCode } from "../src/components/ward-management/ward-sites";

const modesSource = readFileSync("src/components/ward-management/ward-management-modes.tsx", "utf8");

/**
 * The eight views, read from the data the rail, the panel and the drawer all render from.
 *
 * This used to be a regex over `WardModeNavigation`'s own source text, because the eight
 * destinations only existed as eight literal `<Link href="...">` blocks inside that function.
 * They now live in `WARD_VIEWS` (`ward-nav.ts`), which is both a stronger check — it reads what
 * ships rather than what the source happens to spell — and the reason a labelled sidebar was
 * possible at all: a panel cannot read a rail's icon-only JSX, and a second hand-maintained copy
 * of the same eight destinations is the exact defect `ward-nav.ts` exists to prevent.
 */
function wardModeHrefs() {
  return WARD_VIEWS.map((view) => view.href);
}

function routeFileFor(href: string) {
  return `src/app${href}/page.tsx`;
}

describe("Ward Flow synthetic prototype", () => {
  it("declares every queue and capacity header as a column header", () => {
    const thTags = [...modesSource.matchAll(/<th(?:\s[^>]*)?>/g)].map((match) => match[0]);
    // Task 8 (spec item 6) added three capacity-board columns — Sex mix, Specialling, and MHA
    // authorised — raising the count from 12 to 15. Phase 5 added a fourth, "Coordinator action"
    // (the coordinator's refresh control, spec D12), raising it again to 16. The former "Bed
    // states" header covered five raw counts in one cell; it now shows Confirmed and Predicted
    // (via capacityBreakdown) instead of a single undifferentiated count, so the header text
    // dropped its "five" framing — the column itself is unchanged and still counted once here.
    expect(thTags).toHaveLength(16);
    expect(thTags.every((tag) => tag.includes('scope="col"'))).toBe(true);
  });

  // Ward Flow is deliberately absent from the Tools catalogue — see
  // tests/ward-flow-sandbox.test.ts, which asserts no catalogue entry's href
  // starts with "/ward-management" or "/mockups/ward-flow". Reachability here
  // is instead through the developer-gated hub panel (also asserted there).

  it("maps every Ward Flow view to a distinct reachable route", () => {
    const hrefs = wardModeHrefs();
    expect(hrefs).toEqual([
      "/mockups/ward-flow",
      "/mockups/ward-flow/network",
      "/mockups/ward-flow/queue",
      "/mockups/ward-flow/capacity",
      "/mockups/ward-flow/movements",
      "/mockups/ward-flow/exceptions",
      "/mockups/ward-flow/transport",
      "/mockups/ward-flow/governance",
    ]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(existsSync(routeFileFor(href)), `${href} has no page.tsx`).toBe(true);
    }
  });

  it("uses only synthetic operational movement identifiers and minimised fields", () => {
    expect(wardMovements).toHaveLength(48);
    for (const movement of wardMovements) {
      expect(movement.id).toMatch(/^WF-\d{3}$/);
      expect(movement).not.toHaveProperty("name");
      expect(movement).not.toHaveProperty("dateOfBirth");
      expect(movement).not.toHaveProperty("mrn");
      expect(movement).not.toHaveProperty("address");
      expect(movement).not.toHaveProperty("diagnosis");
      expect(movement).not.toHaveProperty("clinicalHistory");
    }
  });

  it("keeps human urgency tiers within range and referrals within the parallel-referral cap", () => {
    for (const movement of wardMovements) {
      expect([1, 2, 3]).toContain(movement.urgency);
      expect(movement.referredUnitIds.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
    }
  });

  it("models the approved seven movement stages, counts derived from the movements themselves", () => {
    expect([...MOVEMENT_STAGES]).toEqual([
      "placement_requested",
      "destination_review",
      "accepted_awaiting_bed",
      "bed_held",
      "handover_ready",
      "moving",
      "arrived",
    ]);
    const total = MOVEMENT_STAGES.reduce(
      (sum, stage) => sum + wardMovements.filter((movement) => movement.stage === stage).length,
      0,
    );
    expect(total).toBe(wardMovements.length);
  });

  it("models units with a real five-figure capacity picture, not a single available count", () => {
    for (const unit of allUnits()) {
      expect(unit).toEqual(
        expect.objectContaining({
          beds: expect.any(Number),
          held: expect.any(Number),
          blocked: expect.any(Number),
          empty: expect.objectContaining({ value: expect.any(Number), confirmedAt: expect.any(Number) }),
          allocatable: expect.objectContaining({ value: expect.any(Number), confirmedAt: expect.any(Number) }),
        }),
      );
    }
  });

  it("preserves plain-language legal status and form readiness", () => {
    const referredMovement = movementById("WF-001");
    expect(referredMovement?.legalStatus).toBe("Referred for psychiatric examination");
    expect(referredMovement?.legalForm?.code).toBe("1A");
    // MEANING CHANGED 2026-08-24, deliberately. This used to assert the prototype's own stored
    // label, "Referral for examination". Ward Flow no longer holds titles: the movement stores
    // the code, and `legalFormName` resolves the Chief Psychiatrist register's official title —
    // which for a 1A is "Referral for examination by a psychiatrist", four words longer. The
    // assertion is now about what a reader actually sees, not about a field that no longer
    // exists, and it would fail if the register stopped listing 1A rather than passing on a
    // locally-held fallback.
    expect(legalFormName(referredMovement!.legalForm!)).toBe("Form 1A (Referral for examination by a psychiatrist)");
  });

  it("labels how long a movement has been waiting, not how overdue it is", () => {
    // WF-001 opened 95 minutes before NOW_ANCHOR — this exercises elapsedLabel itself
    // (not just formatElapsed) so a future transposition of its minutesUntil arguments
    // back to the original bug (minutesUntil(movement.openedAt, now), which yields a
    // negative/clamped duration) fails this assertion.
    const movement = movementById("WF-001");
    expect(movement).toBeDefined();
    expect(elapsedLabel(movement!, NOW_ANCHOR)).toBe("1h 35m waiting");
  });
});

/**
 * Phase 8 Task 6. `originServiceFit` compares the candidate unit's health service against the
 * health service of the emergency department the patient presented to — two service names, and
 * nothing else. It labelled the matching case **"Best"**, which on screen read as the system's
 * opinion about which bed this person should have: a ranking claim over a comparison it never
 * made. Phase 8 puts honest travel bands on this same screen, and an unchecked superlative
 * sitting beside a checked band reads as though it had been checked too.
 *
 * The regex is the same shape as the one `tests/ward-travel-bands.test.ts` holds over the band
 * labels, so the two proximity/ranking surfaces on this screen refuse the same vocabulary rather
 * than each holding their own idea of it.
 */
describe("originServiceFit states a fact, never a ranking", () => {
  const COMPARATIVE = /best|nearest|closest|furthest|most remote|hardest|optimal|recommended|worst/i;

  function labelsAcrossTheFixture() {
    return wardMovements.flatMap((movement) => allUnits().map((unit) => originServiceFit(movement, unit)));
  }

  it("labels the match and the mismatch by what was compared, and nothing more", () => {
    // Named cases first, so the sweep below cannot pass by returning one constant everywhere.
    const matching = wardMovements
      .flatMap((movement) => allUnits().map((unit) => ({ movement, unit })))
      .find(({ movement, unit }) => {
        const unitService = siteByCode(unit.siteCode)?.service;
        // `undefined === undefined` is not a match: the function's own guard requires a real
        // service on the unit's site before it will call the two the same.
        return unitService !== undefined && unitService === movementHealthService(movement);
      });
    const differing = wardMovements
      .flatMap((movement) => allUnits().map((unit) => ({ movement, unit })))
      .find(({ movement, unit }) => {
        const unitService = siteByCode(unit.siteCode)?.service;
        return unitService !== undefined && unitService !== movementHealthService(movement);
      });

    // Non-vacuity: the shipped fixture really does contain both branches, so neither assertion
    // below is passing because its case never occurs.
    expect(matching).toBeDefined();
    expect(differing).toBeDefined();

    expect(originServiceFit(matching!.movement, matching!.unit).label).toBe("Same health service");
    expect(originServiceFit(differing!.movement, differing!.unit).label).toBe("Different health service");
  });

  it("never labels a candidate with a comparative or ranking word", () => {
    const labels = labelsAcrossTheFixture().map((fit) => fit.label);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label, `"${label}" ranks a candidate rather than stating what was compared`).not.toMatch(COMPARATIVE);
    }
    // Exactly two answers ship, so a third label cannot appear unnoticed.
    expect([...new Set(labels)].sort()).toEqual(["Different health service", "Same health service"]);
  });
});
