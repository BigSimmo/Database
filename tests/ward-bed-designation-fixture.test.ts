import { describe, expect, it } from "vitest";

import { WARD_LOCKED_BED_SPLITS, wardSites } from "@/components/ward-management/ward-sites";
import { openBeds } from "@/components/ward-management/ward-bed-designation";

const units = wardSites.flatMap((site) => site.units);

describe("invented bed designations", () => {
  it("covers every unit, so no ward silently defaults to zero locked beds", () => {
    const missing = units.filter((unit) => !(unit.id in WARD_LOCKED_BED_SPLITS)).map((unit) => unit.id);
    expect(missing, `units with no recorded split: ${missing.join(", ")}`).toEqual([]);
  });

  it("never designates more locked beds than the ward has", () => {
    const over = units.filter((unit) => unit.lockedBeds > unit.beds).map((unit) => unit.id);
    expect(over, `units whose locked beds exceed their total: ${over.join(", ")}`).toEqual([]);
  });

  it("never frees more locked beds than it has allocatable", () => {
    const over = units.filter((unit) => unit.allocatableLocked > unit.allocatable.value).map((unit) => unit.id);
    expect(over).toEqual([]);
  });

  // ⚠️ Anti-vacuity: floor the population, never the violation count. The naive per-unit rule
  // (security "Open" -> 0, security "Secure" -> full beds) produces exactly ONE genuinely mixed
  // ward, which would leave the entire mixed-bed code path resting on a single fixture row.
  //
  // ⚠️ THE FLOOR WAS 3 AND IS NOW 2, AND THE REASON IS THE POINT. Reaching three meant inventing a
  // third mixed ward, and BOTH attempts at that broke something real:
  //
  //   1. Adding locked beds to `scgh-adult-open` and `fre-adult-open` — wards the fixture calls
  //      OPEN — gave each a free locked bed, which made WF-009 (Secure, Involuntary) placeable
  //      where he had nowhere eligible. Six tests red, one of them a clinical regression.
  //   2. Splitting `rph-adult-secure` instead looked safe because its free locked beds did not
  //      move. It is referenced by FORTY-SEVEN test files, and `restrictionNotice` deliberately
  //      fires only for a WHOLLY locked ward — so the moment it gained open beds, three warnings
  //      that tell a coordinator "this ward is more locked-down than this patient needs" went
  //      silent.
  //
  // Both attempts changed a clinical answer by editing invented data. The honest floor is what the
  // fixture actually supports without inventing anything further: `fsh-adult-secure` (12 of 18,
  // mostly locked) and `bty-adult-secure` (4 of 17, mostly open) — the owner's own worked example.
  // TWO wards exercising the split in OPPOSITE directions is better coverage than three reached by
  // inventing a ward that has to be someone else's.
  //
  // If a real network ever supplies more mixed wards, raise this — but raise it from real data,
  // never by choosing a unit because its numbers happen to be convenient.
  it("includes at least two genuinely mixed wards, in both directions, or the change is under-tested", () => {
    const mixed = units.filter((unit) => unit.lockedBeds > 0 && openBeds(unit) > 0);
    const ids = mixed.map((unit) => unit.id);
    expect(mixed.length, `mixed wards found: ${ids.join(", ") || "none"}`).toBeGreaterThanOrEqual(2);

    // Both directions, so neither branch of the locked/open arithmetic rests on one shape.
    expect(
      mixed.some((unit) => unit.lockedBeds > openBeds(unit)),
      `no mostly-LOCKED mixed ward among: ${ids.join(", ")}`,
    ).toBe(true);
    expect(
      mixed.some((unit) => openBeds(unit) > unit.lockedBeds),
      `no mostly-OPEN mixed ward among: ${ids.join(", ")}`,
    ).toBe(true);
  });

  it("keeps Bentley adult as a mixed ward — the owner's own worked example", () => {
    const bentley = units.find((unit) => unit.id === "bty-adult-secure");
    expect(bentley).toBeDefined();
    expect(bentley!.lockedBeds).toBeGreaterThan(0);
    expect(openBeds(bentley!)).toBeGreaterThan(0);
  });
});
