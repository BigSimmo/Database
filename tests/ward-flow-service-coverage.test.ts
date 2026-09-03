import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

/**
 * A health service cannot go missing from the screens that group by it.
 *
 * WHY THIS EXISTS. The owner intends to replace this invented network with real WA figures and,
 * in his words, to allow "real parts changing in real life as well ... i.e. building another
 * hospital or more beds". A hospital in a SIXTH health service was, until 2026-08-29, a silent
 * data loss: `HealthService` was a bare type union with no runtime array — the only multi-value
 * union in `ward-model.ts` without one — the five services were re-typed by hand in
 * `wardServiceOrder`, and `ward-management-network.tsx` tested membership through a
 * `readonly string[]` cast that defeated the compiler too. Add the sixth and it compiled clean,
 * then simply was not on the network map or the ED screen's unit table. No error, no red test.
 *
 * `ward-model.ts`'s own `COHORTS` comment records the same defect having already happened once
 * with `Cohort`, which is why this is a repeat rather than a hypothetical.
 *
 * WHY ONE ASSERTION IS ENOUGH, and this is the part worth reading before adding more. Every
 * surface that groups by health service derives its list from `wardServiceOrder` rather than
 * holding its own — verified when this was written, and pinned by the second test below:
 *
 *   ed/ed-screen.tsx                  `wardServiceOrder.flatMap(...)` builds the unit table
 *   ward-management-network.tsx       `columnServices.right` is `wardServiceOrder.filter(...)`
 *   coordinator/flow-diagram.tsx      groups by `wardServiceOrder`
 *   wards/ward-index.tsx              headings run in `wardServiceOrder`
 *
 * So a service present in `HEALTH_SERVICES` and absent from `wardServiceOrder` is invisible on all
 * four, and a service present in both is visible on all four. The completeness of that ONE list is
 * the whole property.
 *
 * WHAT THIS DOES NOT CLAIM. It does not check which COLUMN a service lands in on the network map —
 * `LEFT_COLUMN_SERVICES` decides that, and a service missing from it still appears, on the right.
 * Placement is a presentation choice; presence is the safety property. Stated so the next reader
 * knows the gap is deliberate rather than overlooked.
 */

/** The four surfaces that group by health service. Each must derive from `wardServiceOrder` rather
 *  than hold its own copy — that is what makes the single completeness assertion above sufficient
 *  for all of them, and re-typing a list here is exactly how the original hole was dug. */
const SERVICE_GROUPING_SURFACES = new Map([
  ["src/components/ward-management/ed/ed-screen.tsx", "the statewide unit table"],
  ["src/components/ward-management/ward-management-network.tsx", "the network map's two columns"],
  ["src/components/ward-management/coordinator/flow-diagram.tsx", "the flow diagram's service groups"],
  ["src/components/ward-management/wards/ward-index.tsx", "the ward index's service headings"],
]);

describe("no health service can go missing from the screens that group by it", () => {
  it("knows what it is checking, so it cannot pass by scanning nothing", () => {
    // The canary. Both assertions below pass by finding no discrepancy, which reads identically to
    // an empty list on either side.
    expect(HEALTH_SERVICES.length).toBeGreaterThan(1);
    expect(wardServiceOrder.length).toBeGreaterThan(1);
    expect(SERVICE_GROUPING_SURFACES.size).toBe(4);
  });

  it("orders exactly the health services that exist, each once", () => {
    const declared = [...HEALTH_SERVICES].sort();
    const ordered = [...wardServiceOrder].sort();

    expect(
      ordered,
      "wardServiceOrder and HEALTH_SERVICES disagree. Every screen that groups by health service " +
        "derives its list from wardServiceOrder, so a service in HEALTH_SERVICES and missing here " +
        "is absent from the network map, the ED unit table, the flow diagram and the ward index — " +
        "silently, with no error and no other failing test. Add it to wardServiceOrder, deciding " +
        "where in the order it belongs; do not remove it from HEALTH_SERVICES to make this pass.",
    ).toEqual(declared);

    expect(new Set(wardServiceOrder).size, "wardServiceOrder contains a duplicate").toBe(wardServiceOrder.length);
  });

  it("keeps every grouping surface deriving from that one list rather than holding its own", () => {
    const offenders = [...SERVICE_GROUPING_SURFACES.keys()].filter(
      (file) => !readFileSync(file, "utf8").includes("wardServiceOrder"),
    );

    expect(
      offenders,
      "A surface that groups by health service no longer derives from wardServiceOrder. The " +
        "completeness check above only protects these screens while they all read that one list — " +
        "a hand-written copy is exactly how the original hole was dug, and it would be invisible " +
        "to every other test.",
    ).toEqual([]);
  });
});
