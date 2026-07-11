import { describe, expect, it } from "vitest";

import { parseEntryFile, parseScenarioPresets, parseSearchAliases } from "../scripts/lib/parse-differentials-export";
import {
  composeDifferentialSearchResults,
  differentialDiagnosesCards,
  differentialPresentations,
  differentialPresentationsCards,
  differentialRecords,
  differentialStaticParams,
  getDifferentialRecord,
  getPresentationWorkflow,
  getPresentationWorkflowForDiagnosisIds,
  getPresentationWorkflowSelectionForDiagnosisIds,
  loadDifferentialSnapshot,
  rankDifferentialRecords,
  rankPresentationWorkflows,
  searchDifferentialRecords,
  searchPresentationWorkflows,
  type DifferentialPresentationMatch,
  type DifferentialRecord,
  type DifferentialRecordMatch,
} from "@/lib/differentials";

describe("presentation workflow routing", () => {
  it("routes selected diagnoses to a workflow that contains them", () => {
    expect(getPresentationWorkflowForDiagnosisIds(["bipolar-depression-mixed-state"])?.id).toBe(
      "suicidal-ideation-suicide-attempt-self-harm",
    );
    expect(getPresentationWorkflowForDiagnosisIds([])).toBeNull();
  });

  it("forwards only diagnoses supported by the selected workflow", () => {
    const selection = getPresentationWorkflowSelectionForDiagnosisIds([
      "wernicke-encephalopathy",
      "major-depressive-disorder",
    ]);
    expect(selection?.workflow.id).toBe("acute-confusion-encephalopathy");
    expect(selection?.diagnosisIds).toEqual(["wernicke-encephalopathy"]);
  });
});

const deliriumEntry = `=== ENTRY 1 ===
Delirium / Acute Confusion / Encephalopathy

Urgency: emergent
Axis: organic
Population: general

TRIAGE RATIONALE:
Delirium and its encephalopathic mimics are acute medical emergencies.

MUST NOT MISS:
- Delirium

MIMICS:
Primary psychosis

CLINICAL HINGE:
Inattention plus altered awareness.

IMMEDIATE ACTIONS:
- Do vitals early

INVESTIGATIONS:
- Blood glucose

OPTIONS:
1. Delirium — Acute change, fluctuating course. Red flags: Sepsis, hypoxia.
2. Substance intoxication — Time-link to use. Red flags: Opioid respiratory depression.

SOURCE: v10`;

describe("differential export parser", () => {
  it("parses presentation entries and options", () => {
    const parsed = parseEntryFile(deliriumEntry);
    expect(parsed.slug).toBe("acute-confusion-encephalopathy");
    expect(parsed.options[0]?.slug).toBe("delirium");
    expect(parsed.options[1]?.slug).toBe("substance-intoxication");
  });

  it("preserves hyphenated option names when splitting summary", () => {
    const parsed = parseEntryFile(`=== ENTRY 1 ===
Delirium / Acute Confusion / Encephalopathy

Urgency: emergent
Axis: organic
Population: general

OPTIONS:
1. Post-ictal confusion — Witnessed or suspected seizure, stereotyped event. Red flags: Non-convulsive status epilepticus.

SOURCE: v10`);
    expect(parsed.options[0]?.name).toBe("Post-ictal confusion");
    expect(parsed.options[0]?.slug).toBe("post-ictal-confusion");
  });

  it("maps standard urgency to routine", () => {
    const parsed = parseEntryFile(`=== ENTRY 15 ===
Anxiety

Urgency: standard
Axis: mixed
Population: general

OPTIONS:
1. GAD — Chronic worry`);
    expect(parsed.status).toBe("routine");
  });

  it("parses scenario presets and search aliases", () => {
    const presets = parseScenarioPresets(
      `## 1. Older adult acute confusion\n- **Query:** \`older adult acute confusion\`\n- **Signals:** Older adult onset\n- **Entries:**\n  - Entry 1 — Delirium`,
    );
    expect(presets[0]?.query).toBe("older adult acute confusion");
    const aliases = parseSearchAliases("| delirium | confusion, fluctuation |");
    expect(aliases.delirium).toContain("confusion");
  });

  it("drops the document preamble and weight-table rows from presets and aliases", () => {
    const presets = parseScenarioPresets(
      `# Scenario Presets\n\nIntro prose mentioning Entry 26.\n\n## 1. Older adult acute confusion\n- **Query:** \`older adult acute confusion\``,
    );
    expect(presets).toHaveLength(1);
    expect(presets[0]?.query).toBe("older adult acute confusion");

    const aliases = parseSearchAliases("| tags | 1.1 |\n| delirium | confusion, 2.0, fluctuation |");
    expect(aliases.tags).toBeUndefined();
    expect(aliases.delirium).toEqual(["confusion", "fluctuation"]);
  });
});

describe("differential records", () => {
  it("loads v10 snapshot with presentations and diagnoses", () => {
    const snapshot = loadDifferentialSnapshot();
    expect(snapshot.presentations).toHaveLength(31);
    expect(snapshot.diagnoses.length).toBeGreaterThan(100);
    expect(differentialRecords.length).toBe(snapshot.diagnoses.length);
  });

  it("links cards to routes", () => {
    expect(differentialDiagnosesCards.every((card) => card.href.startsWith("/differentials/diagnoses/"))).toBe(true);
    expect(
      differentialPresentationsCards.find((card) => card.id === "presentation-acute-confusion-encephalopathy")?.href,
    ).toBe("/differentials/presentations/acute-confusion-encephalopathy");
  });

  it("wires acute confusion candidates to diagnosis records", () => {
    const workflow = getPresentationWorkflow("acute-confusion-encephalopathy");
    expect(workflow?.candidates.every((candidate) => getDifferentialRecord(candidate.slug))).toBe(true);
  });

  it("supports lookup and search", () => {
    expect(getDifferentialRecord("delirium")).not.toBeNull();
    expect(differentialStaticParams().length).toBe(differentialRecords.length);
    expect(searchDifferentialRecords("delirium").length).toBeGreaterThan(0);
  });

  it("ranks exact diagnosis matches first with reasons", () => {
    const matches = rankDifferentialRecords(differentialRecords, "delirium");
    expect(matches[0]?.record.slug).toBe("delirium");
    expect(matches[0]?.reasons).toContain("title");
    expect(matches[0]?.score ?? 0).toBeGreaterThan(0);
    // Ranked order is monotonic by score.
    for (let index = 1; index < matches.length; index += 1) {
      expect(matches[index - 1]!.score).toBeGreaterThanOrEqual(matches[index]!.score);
    }
  });

  it("surfaces symptom-alias matches from the imported alias table", () => {
    // "confused" expands via the catalogue searchAliases to confusion/delirium/
    // encephalopathy, so the delirium record matches through the alias path.
    const matches = rankDifferentialRecords(differentialRecords, "confused");
    const delirium = matches.find((match) => match.record.slug === "delirium");
    expect(delirium).toBeDefined();
    expect(delirium?.reasons).toContain("symptom alias");
  });

  it("returns no ranked matches for an empty query but keeps the legacy full-set contract", () => {
    expect(rankDifferentialRecords(differentialRecords, "  ")).toEqual([]);
    expect(rankPresentationWorkflows(differentialPresentations(), "")).toEqual([]);
    expect(searchDifferentialRecords("").length).toBe(differentialRecords.length);
    expect(searchPresentationWorkflows("").length).toBe(differentialPresentations().length);
  });

  it("ranks the acute confusion presentation first for its own vocabulary", () => {
    const matches = rankPresentationWorkflows(differentialPresentations(), "acute confusion");
    expect(matches[0]?.workflow.id).toBe("acute-confusion-encephalopathy");
  });

  it("does not leak service registry terms", () => {
    const combinedDifferentialText = JSON.stringify({
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
});

function makeRecord(slug: string, status: DifferentialRecord["status"] = "routine"): DifferentialRecord {
  return {
    slug,
    title: slug,
    status,
    subtitle: `${slug} subtitle`,
    clinicalHinge: `${slug} hinge`,
    safetySnapshot: { summary: `${slug} safety`, tags: [] },
    sections: [],
    related: [],
    currentPresentation: [`${slug} presentation feature`],
    investigations: [`${slug} test`],
    immediateActions: [],
  };
}

function diagnosisMatch(slug: string, score: number): DifferentialRecordMatch {
  return { record: makeRecord(slug), score, reasons: ["title"] };
}

function presentationMatch(id: string, score: number, candidateSlugs: string[]): DifferentialPresentationMatch {
  return {
    workflow: {
      id,
      title: id,
      status: "emergent",
      subtitle: `${id} subtitle`,
      selectedCount: 0,
      totalCount: candidateSlugs.length,
      safetySnapshot: { summary: `${id} safety`, tags: ["tag-one"] },
      criteria: [],
      candidates: candidateSlugs.map((slug) => ({ slug, selected: false, comparison: {} })),
      reviewChecklist: [],
      highestUrgencyNote: "",
      sourceStatus: { label: "", version: "", lastUpdated: "" },
    },
    score,
    reasons: ["title"],
  };
}

describe("composeDifferentialSearchResults", () => {
  it("leads with a presentation when it matches about as strongly as the best diagnosis", () => {
    const results = composeDifferentialSearchResults(
      [diagnosisMatch("alpha", 10), diagnosisMatch("beta", 8)],
      [presentationMatch("workflow-one", 9, ["beta"])],
    );
    expect(results[0]).toMatchObject({ kind: "presentation", id: "workflow-one", matchLabel: "Best match" });
    // Candidate diagnoses of the lead presentation come before other diagnoses.
    expect(results[1]).toMatchObject({ kind: "diagnosis", id: "beta" });
    expect(results[2]).toMatchObject({ kind: "diagnosis", id: "alpha" });
  });

  it("leads with diagnoses when the presentation match is weak", () => {
    const results = composeDifferentialSearchResults(
      [diagnosisMatch("alpha", 20)],
      [presentationMatch("workflow-one", 3, [])],
    );
    expect(results[0]).toMatchObject({ kind: "diagnosis", id: "alpha" });
    expect(results[1]).toMatchObject({ kind: "presentation", id: "workflow-one" });
  });

  it("dedupes by id, caps at the limit, and tiers match labels", () => {
    const diagnoses = Array.from({ length: 12 }, (_, index) => diagnosisMatch(`dx-${index}`, 20 - index));
    const results = composeDifferentialSearchResults([...diagnoses, diagnosisMatch("dx-0", 20)], []);
    expect(results).toHaveLength(8);
    expect(new Set(results.map((result) => result.id)).size).toBe(8);
    expect(results[0]?.matchLabel).toBe("Best match");
    expect(results[1]?.matchLabel).toBe("High match");
    const lowest = composeDifferentialSearchResults([diagnosisMatch("a", 9), diagnosisMatch("b", 4)], []);
    expect(lowest[1]?.matchLabel).toBe("Lower match");
  });

  it("maps hrefs to the catalogue detail pages", () => {
    const results = composeDifferentialSearchResults(
      [diagnosisMatch("alpha", 10)],
      [presentationMatch("workflow-one", 10, [])],
    );
    const presentation = results.find((result) => result.kind === "presentation");
    const diagnosis = results.find((result) => result.kind === "diagnosis");
    expect(presentation?.href).toBe("/differentials/presentations/workflow-one");
    expect(diagnosis?.href).toBe("/differentials/diagnoses/alpha");
  });
});

describe("ranked differential search", () => {
  it("ranks title matches above content-only matches", () => {
    const matches = rankDifferentialRecords(differentialRecords, "delirium");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].record.slug).toContain("delirium");
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[matches.length - 1].score);
    expect(matches[0].reasons).toContain("title");
  });

  it("keeps the full catalogue for an empty query and still honours aliases", () => {
    expect(searchDifferentialRecords("")).toEqual(differentialRecords);
    expect(searchDifferentialRecords("   ")).toEqual(differentialRecords);
  });
});
