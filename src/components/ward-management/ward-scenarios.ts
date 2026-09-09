import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits } from "@/components/ward-management/ward-sites";

export type WardScenario = "standard" | "scarce";
export const WARD_SCENARIOS: readonly WardScenario[] = ["standard", "scarce"] as const;

export const scenarioLabels: Record<WardScenario, string> = {
  standard: "Standard night",
  scarce: "Scarce beds",
};

/**
 * The scarce night differs from the standard night in OPERATIONAL NUMBERS ONLY. It carries the
 * same units, the same patients and the same identities; what changes is how many beds a ward
 * can actually allocate and how much one-to-one observation it can staff. Nothing here is a
 * clinical, legal or patient-level difference, and nothing here may become one.
 */
export function scenarioUnits(scenario: WardScenario): Unit[] {
  const units = structuredClone(allUnits());
  if (scenario === "standard") return units;
  return units.map((unit, index) => ({
    ...unit,
    // Every third unit keeps a single allocatable bed; the rest have none. A single bed still
    // fails the sex_mix gate unless the ward already holds same-sex occupants, which is exactly
    // the squeeze a real scarce night produces.
    allocatable: { ...unit.allocatable, value: index % 3 === 0 ? 1 : 0 },
    speciallingCapacity: 0,
  }));
}
