import { describe, expect, it } from "vitest";
import { WA_CRISIS_CONTACTS } from "@/lib/crisis-contacts";
import { getContacts, getServiceProfile, loadModelInputs } from "@/lib/first-nations/content";
import { firstNationsPageIds, situationIds } from "@/lib/first-nations/content-schema";
import { buildBedsideModel, buildInnerPageModel, buildSearchIndex } from "@/lib/first-nations/view-model";

const inputs = loadModelInputs();

describe("First Nations content", () => {
  it("keeps duplicated crisis numbers and verification dates aligned with the canonical registry", () => {
    const contacts = [
      ...inputs.content.statewideContacts,
      ...inputs.content.pages.flatMap((p) => p.sections.flatMap((s) => s.modules.flatMap((m) => m.blocks))),
    ].filter((b) => b.kind === "contact");
    for (const canonical of WA_CRISIS_CONTACTS.filter((c) =>
      ["SYN-CRISIS-CONTACT-002", "SYN-CRISIS-CONTACT-003", "SYN-CRISIS-CONTACT-004", "SYN-CRISIS-CONTACT-007"].includes(
        c.id,
      ),
    )) {
      const copies = contacts.filter((c) => c.number.replace(/\D/g, "") === canonical.telephoneUri);
      expect(copies.length).toBeGreaterThan(0);
      for (const copy of copies) expect(copy.checkedAt, copy.id).toBe(canonical.verifiedOn);
    }
  });
  it("indexes only contacts with a visible page destination", () => {
    const index = buildSearchIndex(inputs);
    expect(index.some((entry) => entry.title === "Aboriginal Interpreting WA")).toBe(true);
    for (const id of ["brams", "wirraka-maya", "grams", "bega", "derbarl", "swams"]) {
      expect(
        index.some((entry) => entry.id === id),
        id,
      ).toBe(false);
      expect(
        buildBedsideModel(inputs).regions.some((r) => r.services.some((c) => c.id === id)),
        id,
      ).toBe(true);
    }
  });
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
