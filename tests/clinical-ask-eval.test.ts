import { describe, expect, it } from "vitest";

import type { ClinicalAskDraft, ClinicalAskEvidence } from "@/lib/clinical-ask/contracts";
import { clinicalAskModeIds } from "@/lib/clinical-ask/contracts";
import { clinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";
import { governClinicalAskDraft } from "@/lib/clinical-ask/response-governance";
import { buildClinicalAskTelemetry } from "@/lib/clinical-ask/telemetry";
import { clinicalAskCases } from "./fixtures/clinical-ask-cases";

describe("Clinical Ask synthetic evaluation", () => {
  it.each(clinicalAskModeIds)("governs a supported %s answer", (mode) => {
    const profile = clinicalAskModeProfile(mode);
    const text = "The source indicates the synthetic clinical detail may apply.";
    const evidence: ClinicalAskEvidence = {
      id: `catalogue:${mode}:synthetic`,
      tier: "catalogue",
      title: "Synthetic source",
      publisher: "Synthetic publisher",
      jurisdiction: null,
      href: "/synthetic",
      extract: text,
      reviewState: "reviewed",
      publishedAt: "2026-01-01",
      updatedAt: "2026-06-01",
      retrievedAt: null,
    };
    const claim = (id: string) => ({ id, text, evidenceIds: [evidence.id] });
    const draft: ClinicalAskDraft = {
      mode,
      lead: claim("lead"),
      sections: profile.sectionOrder.map((id) => ({ id, title: id, claims: [claim(id)] })),
      conflicts: [],
      missingInformation: [],
      followUps: [],
      handoffs: [],
    };
    expect(governClinicalAskDraft(profile, draft, [evidence]).state).toBe("answered");
  });

  it("serializes only allowlisted telemetry", () => {
    const fixture = clinicalAskCases[0];
    const forbidden = [
      fixture.question,
      ...Object.values(fixture.confirmedContext).flat(),
      "synthetic transcript",
      "synthetic answer",
      "synthetic extract",
      "https://example.invalid/private",
    ];
    const telemetry = buildClinicalAskTelemetry({
      mode: fixture.mode,
      inputTransport: fixture.inputTransport,
      clarificationOccurred: false,
      tiersUsed: ["catalogue", "indexed"],
      externalResult: "not_attempted",
      responseState: "answered",
      failureClass: null,
      elapsedMs: 2_000,
    });
    const serialized = JSON.stringify(telemetry);
    for (const value of forbidden) expect(serialized).not.toContain(String(value));
    expect(telemetry.latencyBucket).toBe("1_3s");
  });
});
