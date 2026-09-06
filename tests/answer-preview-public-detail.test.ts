import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Two independent reviews landed on the same finding: `lastEvidencePreviewReason` is
 * process-global with no user or interaction correlation, so an exact timestamp on an
 * unauthenticated endpoint is a pollable record of when this tool is used clinically — and, the
 * day a second clinician exists, one person's outcome answering another's question.
 *
 * The response was to bucket the time rather than withdraw the diagnostic, because withdrawing it
 * returns the endpoint to reading `Ready.` forever, which is the defect it was built to fix. These
 * tests pin the half that makes that trade sound: the decision word survives for both audiences,
 * and only the operator gets the second hand.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadPreview(enabled = true) {
  vi.doMock("@/lib/env", () => ({ env: { RAG_INCREMENTAL_EVIDENCE_PREVIEW: enabled } }));
  return import("../src/lib/answer-preview");
}

describe("answer-preview public detail", () => {
  it("gives the anonymous caller the reason but never a precise time", async () => {
    const mod = await loadPreview();
    mod.recordEvidencePreviewContractRejection();

    const anon = mod.describeEvidencePreviewForAnyCaller();
    const operator = mod.describeEvidencePreviewForOperator();

    // Both audiences learn the decision — that is the whole point of the exemption.
    expect(anon).toContain("contract_rejected");
    expect(operator).toContain("contract_rejected");
    // Only the operator learns exactly when. An ISO timestamp is the timeline this withholds.
    expect(operator).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(anon).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(anon).toContain("in the last few minutes");
    // And it says whose answer it is describing, because nothing correlates it to the reader.
    expect(anon).toContain("this server");
  });

  it("never emits anything but a known reason word", async () => {
    const mod = await loadPreview();
    // Nothing has been recorded, so there is no reason to leak.
    expect(mod.describeEvidencePreviewForAnyCaller()).toBe(
      "On. This server has not served an answer yet, so there is nothing to report.",
    );
  });

  it("says the feature is off rather than implying a healthy rail", async () => {
    const mod = await loadPreview(false);
    expect(mod.describeEvidencePreviewForAnyCaller()).toContain("Switched off");
    expect(mod.describeEvidencePreviewForOperator()).toContain("Switched off");
  });
});
