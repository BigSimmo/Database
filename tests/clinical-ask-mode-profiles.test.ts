import { describe, expect, it } from "vitest";
import { clinicalAskModeIds } from "@/lib/clinical-ask/contracts";
import { clinicalAskModeProfiles } from "@/lib/clinical-ask/mode-profiles";

describe("Clinical Ask mode profiles", () => {
  it("defines one profile for every supported mode and no extras", () =>
    expect(Object.keys(clinicalAskModeProfiles).sort()).toEqual([...clinicalAskModeIds].sort()));
  it.each(clinicalAskModeIds)("%s declares sections, context, sources, handoffs, and prohibitions", (mode) => {
    const value = clinicalAskModeProfiles[mode];
    expect(value.sectionOrder.length).toBeGreaterThan(2);
    expect(value.acceptedContextFields.length).toBeGreaterThan(0);
    expect(value.indexedDomains.length).toBeGreaterThan(0);
    expect(value.allowedAuthorityIds.length).toBeGreaterThan(0);
    expect(value.prohibitedOutcomes.length).toBeGreaterThan(0);
    expect(new Set(value.sectionOrder).size).toBe(value.sectionOrder.length);
  });
});
