import { describe, expect, it } from "vitest";
import { getContacts, getServiceProfile, loadModelInputs } from "@/lib/first-nations/content";
import { firstNationsPageIds, situationIds } from "@/lib/first-nations/content-schema";
import { buildBedsideModel, buildInnerPageModel, buildSearchIndex } from "@/lib/first-nations/view-model";

const inputs = loadModelInputs();

describe("First Nations content", () => {
  it("has all nine pages and the six fixed situations", () => {
    expect(inputs.content.pages.map((p) => p.id).sort()).toEqual([...firstNationsPageIds].sort());
    expect(inputs.content.situations.map((s) => s.id)).toEqual([...situationIds]);
  });
  it("references only registered sources", () => {
    const known = new Set(Object.keys(inputs.sources));
    const used = [
      ...inputs.content.pages.flatMap((p) =>
        p.sections.flatMap((s) => s.modules.flatMap((m) => m.blocks.map((b) => b.sourceId))),
      ),
      ...inputs.content.situations.flatMap((s) => s.phrases.map((p) => p.sourceId)),
      ...inputs.content.statewideContacts.map((c) => c.sourceId),
      ...inputs.content.riskLines.map((r) => r.sourceId),
      ...inputs.content.regions.map((r) => r.sourceId),
      inputs.map.sourceId,
    ];
    for (const id of used) expect(known.has(id), id).toBe(true);
  });
  it("draws a map region for every content region and nothing else", () => {
    expect(inputs.map.regions.map((r) => r.id).sort()).toEqual(inputs.content.regions.map((r) => r.id).sort());
  });
  it("hides the EMHS layer everywhere while it is disabled", () => {
    expect(getServiceProfile()).toBeNull();
    expect(getContacts().every((c) => c.layer === "statewide")).toBe(true);
    const everything = JSON.stringify([
      buildBedsideModel(inputs),
      ...firstNationsPageIds.filter((id) => id !== "bedside").map((id) => buildInnerPageModel(inputs, id)),
      buildSearchIndex(inputs),
    ]);
    expect(everything).not.toMatch(/Royal Perth|East Metropolitan|EMHS/);
    expect(buildBedsideModel(inputs).hospitals).toEqual([]);
  });
  it("builds every inner page without throwing", () => {
    for (const id of firstNationsPageIds)
      if (id !== "bedside") expect(buildInnerPageModel(inputs, id).sections.length).toBeGreaterThan(0);
  });
});
