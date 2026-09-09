import { describe, expect, it } from "vitest";

import { appModeIds, type AppModeId } from "@/lib/app-modes";
import { phoneModeGroups } from "@/lib/phone-mode-groups";

/**
 * The phone mode sheet renders a grouped list rather than the flat
 * `appModeDefinitions` the desktop menu uses, so it carries its own copy of the
 * mode ids. The render loop drops any mode no group names, and the `satisfies`
 * constraint on `phoneModeGroups` checks membership without checking
 * exhaustiveness — so a mode added to the registry and forgotten here vanishes
 * from every phone with nothing going red.
 *
 * That is exactly what happened to Sources. These cases are the missing gate.
 */
describe("phone mode groups", () => {
  const groupedModeIds = phoneModeGroups.flatMap((group) => group.modeIds as readonly AppModeId[]);

  it("reaches every app mode", () => {
    expect([...groupedModeIds].sort()).toEqual([...appModeIds].sort());
  });

  it("places each mode in exactly one group", () => {
    const seen = new Map<AppModeId, number>();
    for (const modeId of groupedModeIds) seen.set(modeId, (seen.get(modeId) ?? 0) + 1);
    expect([...seen.entries()].filter(([, count]) => count > 1)).toEqual([]);
  });

  it("names only real modes, under unique group ids", () => {
    for (const modeId of groupedModeIds) expect(appModeIds).toContain(modeId);
    const groupIds = phoneModeGroups.map((group) => group.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
  });
});
