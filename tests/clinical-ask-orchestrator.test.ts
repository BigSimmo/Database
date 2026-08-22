import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ClinicalAskDependencies,
  ClinicalAskDraft,
  ClinicalAskEvidence,
  ClinicalAskRequest,
} from "@/lib/clinical-ask/contracts";
import { clinicalAskModeProfile } from "@/lib/clinical-ask/mode-profiles";
import { runClinicalAsk } from "@/lib/clinical-ask/orchestrator";

const question = "Which example evidence applies?";
const claimText = "The source indicates which example evidence applies.";
const evidence = (reviewState: ClinicalAskEvidence["reviewState"] = "reviewed"): ClinicalAskEvidence => ({
  id: `catalogue:${reviewState}`,
  tier: "catalogue",
  title: "Synthetic evidence",
  publisher: "Synthetic publisher",
  jurisdiction: null,
  href: "/synthetic",
  extract: `${question} example location adult assessment review ${claimText}`,
  reviewState,
  publishedAt: "2026-01-01",
  updatedAt: "2026-06-01",
  retrievedAt: null,
});
const completeContext = {
  serviceLocation: "example location",
  population: "adult",
  pathwayStage: "assessment",
  referralPurpose: "review",
};
const request = (overrides: Partial<ClinicalAskRequest> = {}): ClinicalAskRequest => ({
  mode: "services",
  question,
  confirmedContext: completeContext,
  clarificationAnswers: {},
  priorTurns: [],
  allowExternalFallback: true,
  inputTransport: "typed",
  ...overrides,
});
function validDraft(source = evidence()): ClinicalAskDraft {
  const profile = clinicalAskModeProfile("services");
  const claim = (id: string) => ({ id, text: claimText, evidenceIds: [source.id] });
  return {
    mode: "services",
    lead: claim("lead"),
    sections: profile.sectionOrder.map((id) => ({ id, title: id, claims: [claim(id)] })),
    conflicts: [],
    missingInformation: [],
    followUps: [],
    handoffs: [],
  };
}
function fakes(local: ClinicalAskEvidence[] = [evidence()]) {
  return {
    suggestContext: vi.fn<ClinicalAskDependencies["suggestContext"]>().mockResolvedValue([]),
    retrieveCatalogue: vi.fn<ClinicalAskDependencies["retrieveCatalogue"]>().mockResolvedValue(local),
    retrieveIndexed: vi.fn<ClinicalAskDependencies["retrieveIndexed"]>().mockResolvedValue([]),
    retrieveExternal: vi.fn<ClinicalAskDependencies["retrieveExternal"]>().mockResolvedValue([]),
    synthesize: vi.fn<ClinicalAskDependencies["synthesize"]>().mockImplementation(async () => validDraft(local[0])),
  };
}
const scope = { ownerId: "owner-a", includePublic: true };

afterEach(() => vi.useRealTimers());

describe("runClinicalAsk", () => {
  it("returns material clarification before retrieval", async () => {
    const dependencies = fakes();
    const response = await runClinicalAsk(
      request({ confirmedContext: {} }),
      scope,
      dependencies,
      new AbortController().signal,
      vi.fn(),
    );
    expect(response.state).toBe("clarification_required");
    expect(dependencies.retrieveCatalogue).not.toHaveBeenCalled();
  });

  it("continues after the clinician answers every requested clarification", async () => {
    const dependencies = fakes();
    const response = await runClinicalAsk(
      request({
        confirmedContext: {},
        clarificationAnswers: {
          "services:serviceLocation": "example location",
          "services:population": "adult",
          "services:pathwayStage": "assessment",
          "services:referralPurpose": "review",
        },
      }),
      scope,
      dependencies,
      new AbortController().signal,
      vi.fn(),
    );
    expect(response.state).toBe("answered");
    expect(dependencies.retrieveCatalogue).toHaveBeenCalledOnce();
  });

  it("skips external retrieval when local evidence is sufficient", async () => {
    const dependencies = fakes();
    const response = await runClinicalAsk(request(), scope, dependencies, new AbortController().signal, vi.fn());
    expect(response.state).toBe("answered");
    expect(dependencies.retrieveExternal).not.toHaveBeenCalled();
  });

  it("uses external only when preference permits it", async () => {
    const local = evidence("needs_review");
    const external = { ...evidence(), id: "external:reviewed", tier: "external" as const };
    const dependencies = fakes([local]);
    dependencies.retrieveExternal.mockResolvedValue([external]);
    dependencies.synthesize.mockImplementation(async () => validDraft(external));
    await runClinicalAsk(request(), scope, dependencies, new AbortController().signal, vi.fn());
    expect(dependencies.retrieveExternal).toHaveBeenCalledTimes(1);

    const disabled = fakes([local]);
    await runClinicalAsk(
      request({ allowExternalFallback: false }),
      scope,
      disabled,
      new AbortController().signal,
      vi.fn(),
    );
    expect(disabled.retrieveExternal).not.toHaveBeenCalled();
  });

  it("degrades safely when external retrieval fails", async () => {
    const local = evidence("needs_review");
    const dependencies = fakes([local]);
    dependencies.retrieveExternal.mockRejectedValue(new Error("synthetic external failure"));
    const response = await runClinicalAsk(request(), scope, dependencies, new AbortController().signal, vi.fn());
    expect(["answered", "evidence_gap"]).toContain(response.state);
  });

  it("retries invalid synthesis at most once and reruns governance", async () => {
    const dependencies = fakes();
    const invalid = validDraft();
    invalid.lead.evidenceIds = [];
    dependencies.synthesize.mockResolvedValueOnce(invalid).mockResolvedValueOnce(validDraft());
    const stages: string[] = [];
    const response = await runClinicalAsk(request(), scope, dependencies, new AbortController().signal, (event) =>
      stages.push(event.stage),
    );
    expect(response.state).toBe("answered");
    expect(dependencies.synthesize).toHaveBeenCalledTimes(2);
    expect(stages).toEqual([...new Set(stages)]);
  });

  it("blocks identifier-shaped input before every injected dependency", async () => {
    const dependencies = fakes();
    const response = await runClinicalAsk(
      request({ question: "Review patient@example.com" }),
      scope,
      dependencies,
      new AbortController().signal,
      vi.fn(),
    );
    expect(response).toMatchObject({ state: "failed", code: "identifiable_input_blocked" });
    for (const dependency of Object.values(dependencies)) expect(dependency).not.toHaveBeenCalled();
  });

  it("stops later tiers after abort", async () => {
    const controller = new AbortController();
    const dependencies = fakes();
    dependencies.retrieveCatalogue.mockImplementation(async (_request: ClinicalAskRequest, signal: AbortSignal) => {
      controller.abort();
      signal.throwIfAborted();
      return [];
    });
    const response = await runClinicalAsk(request(), scope, dependencies, controller.signal, vi.fn());
    expect(response).toMatchObject({ state: "failed", code: "aborted" });
    expect(dependencies.retrieveIndexed).not.toHaveBeenCalled();
    expect(dependencies.synthesize).not.toHaveBeenCalled();
  });

  it("returns an evidence-only fallback at the 45-second deadline", async () => {
    vi.useFakeTimers();
    const dependencies = fakes();
    dependencies.retrieveIndexed.mockImplementation(() => new Promise(() => undefined));
    const pending = runClinicalAsk(request(), scope, dependencies, new AbortController().signal, vi.fn());
    await vi.advanceTimersByTimeAsync(45_000);
    const response = await pending;
    expect(response.state).toBe("evidence_gap");
    if (response.state === "evidence_gap") expect(response.evidence).toHaveLength(1);
  });
});
