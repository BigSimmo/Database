import { beforeEach, describe, expect, it, vi } from "vitest";

const generateStructuredTextResponse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/openai", () => ({ generateStructuredTextResponse }));

import type { ClinicalAskEvidence, ClinicalAskRequest } from "@/lib/clinical-ask/contracts";
import { clinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";
import { synthesizeClinicalAskDraft } from "@/lib/clinical-ask/synthesis";

const request: ClinicalAskRequest = {
  mode: "services",
  question: "Which example service applies?",
  confirmedContext: {
    serviceLocation: "Example city",
    population: "adult",
    pathwayStage: "assessment",
    referralPurpose: "review",
  },
  clarificationAnswers: {},
  priorTurns: [],
  allowExternalFallback: false,
  inputTransport: "typed",
};

const evidence: ClinicalAskEvidence = {
  id: "indexed:example",
  tier: "indexed",
  title: "Example source",
  publisher: "Example publisher",
  jurisdiction: null,
  href: "/documents/example",
  extract: "The source indicates an example service pathway.",
  reviewState: "reviewed",
  publishedAt: "2026-01-01",
  updatedAt: "2026-06-01",
  retrievedAt: null,
};

describe("Clinical Ask structured synthesis", () => {
  beforeEach(() => {
    generateStructuredTextResponse.mockReset();
  });

  it("uses the shared reasoning-aware output budget and an OpenAI-compatible strict schema", async () => {
    const profile = clinicalAskModeProfile("services");
    const claim = (id: string) => ({
      id,
      text: "The source indicates an example service pathway.",
      evidenceIds: [evidence.id],
    });
    generateStructuredTextResponse.mockResolvedValue(
      JSON.stringify({
        mode: "services",
        lead: claim("lead"),
        sections: profile.sectionOrder.map((id) => ({ id, title: id, claims: [claim(`claim:${id}`)] })),
        conflicts: [],
        missingInformation: [],
        followUps: [],
        handoffs: [],
      }),
    );

    await expect(synthesizeClinicalAskDraft(request, [evidence], new AbortController().signal)).resolves.toMatchObject({
      mode: "services",
      lead: { evidenceIds: [evidence.id] },
    });
    const [, schema, options] = generateStructuredTextResponse.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(JSON.stringify(schema)).not.toContain("uniqueItems");
    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["mode", "lead", "sections", "conflicts", "missingInformation", "followUps", "handoffs"],
    });
    expect(options).toMatchObject({
      operation: "answer",
      schemaName: "clinical_ask_draft",
      maxRetries: 0,
      store: false,
    });
    expect(options).not.toHaveProperty("maxOutputTokens");
  });
});
