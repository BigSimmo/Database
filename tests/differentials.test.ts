import { describe, expect, it } from "vitest";

import {
  acuteConfusionPresentationWorkflow,
  differentialDiagnosesCards,
  differentialPresentationsCards,
  differentialRecords,
  differentialStaticParams,
  getDifferentialRecord,
  searchDifferentialRecords,
} from "@/lib/differentials";

describe("differential records", () => {
  it("contains diagnosis records rather than service records", () => {
    expect(differentialRecords.map((record) => record.slug)).toEqual([
      "delirium",
      "pneumonia",
      "substance-intoxication",
      "substance-withdrawal",
      "post-ictal-confusion",
      "wernicke-encephalopathy",
      "hepatic-encephalopathy",
      "meningitis-encephalitis",
      "thyroid-disease",
    ]);

    const combinedDifferentialText = JSON.stringify({
      acuteConfusionPresentationWorkflow,
      differentialRecords,
      differentialDiagnosesCards,
      differentialPresentationsCards,
    }).toLowerCase();

    for (const serviceTerm of [
      "13yarn",
      "mherl",
      "rurallink",
      "medicare mental health",
      "service referral",
      "transport order",
      "mental health act form",
    ]) {
      expect(combinedDifferentialText).not.toContain(serviceTerm);
    }
  });

  it("links diagnosis cards to differential diagnosis detail routes", () => {
    expect(differentialDiagnosesCards.every((card) => card.href.startsWith("/differentials/diagnoses/"))).toBe(true);
    expect(differentialPresentationsCards.find((card) => card.id === "presentation-acute-confusion")?.href).toBe(
      "/differentials/presentations",
    );
  });

  it("wires acute confusion presentation candidates to differential records", () => {
    expect(acuteConfusionPresentationWorkflow.title).toBe("Acute confusion / encephalopathy");
    expect(acuteConfusionPresentationWorkflow.selectedCount).toBe(6);
    expect(acuteConfusionPresentationWorkflow.totalCount).toBe(8);
    expect(acuteConfusionPresentationWorkflow.candidates).toHaveLength(8);
    expect(acuteConfusionPresentationWorkflow.candidates.filter((candidate) => candidate.selected)).toHaveLength(6);
    expect(
      acuteConfusionPresentationWorkflow.candidates.every((candidate) => getDifferentialRecord(candidate.slug)),
    ).toBe(true);
    expect(
      getDifferentialRecord("delirium")?.sections.some((section) => section.items.join(" ").includes("Placeholder")),
    ).toBe(false);
    expect(
      getDifferentialRecord("substance-intoxication")?.sections.some((section) =>
        section.items.join(" ").includes("Placeholder information page"),
      ),
    ).toBe(true);
  });

  it("normalizes lookup, static params, and diagnosis search", () => {
    expect(getDifferentialRecord(" Delirium ")?.title).toBe("Delirium");
    expect(getDifferentialRecord("pneumonia")?.status).toBe("urgent");
    expect(getDifferentialRecord("13yarn")).toBeNull();
    expect(differentialStaticParams()).toHaveLength(differentialRecords.length);
    expect(differentialStaticParams()).toContainEqual({ slug: "wernicke-encephalopathy" });
    expect(searchDifferentialRecords("hypoxia").map((record) => record.slug)).toEqual(["delirium", "pneumonia"]);
    expect(searchDifferentialRecords("13YARN")).toEqual([]);
  });
});
