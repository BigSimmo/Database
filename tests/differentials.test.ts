import { describe, expect, it } from "vitest";

import { parseEntryFile, parseScenarioPresets, parseSearchAliases } from "../scripts/lib/parse-differentials-export";
import {
  differentialDiagnosesCards,
  differentialPresentationsCards,
  differentialRecords,
  differentialStaticParams,
  getDifferentialRecord,
  getPresentationWorkflow,
  loadDifferentialSnapshot,
  rankDifferentialRecords,
  searchDifferentialRecords,
} from "@/lib/differentials";

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

describe("ranked differential search", () => {
  it("ranks title matches above content-only matches", () => {
    const matches = rankDifferentialRecords("delirium");
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
