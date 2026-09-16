import { describe, expect, it, vi } from "vitest";
import { assessDeployedRagActivation, checkDeployedRagActivation } from "../scripts/lib/deployment-rag-activation.mjs";

const sha = "a".repeat(40);
const environment = {
  DEPLOY_EXPECTED_SHA: sha,
  DEPLOY_ACTIVATION_URL: "https://example.test",
  HEALTH_DEEP_PROBE_SECRET: "private-test-token",
};
const payload = {
  status: "ok",
  demoMode: false,
  deploymentCommitSha: sha,
  ragProgramme: {
    configuredMode: "canary",
    candidatePercentage: 100,
    retrieval: { governedRetrievalEnabled: true, mode: "canary" },
    components: { adaptiveAnswer: true, adaptiveRender: true },
    versions: { adaptiveProducerAvailable: true, adaptiveRendererAvailable: true },
    audiences: { guests: "full-rollout", authenticated: "owner-cohort-or-full-rollout" },
    fullRollout: {
      eligible: true,
      adaptiveAnswer: true,
      adaptiveRender: true,
      generationProviderAvailable: true,
      coverageContractAvailable: true,
      reason: "enabled",
    },
  },
};

describe("deployed RAG activation proof", () => {
  it("requires exact serving SHA and effective full adaptive availability for both audiences", () => {
    expect(assessDeployedRagActivation(payload, sha)).toEqual({
      ok: true,
      check: "deployed-rag-activation",
      failures: [],
    });
    expect(assessDeployedRagActivation(payload, "b".repeat(40)).failures).toContain("serving_sha_mismatch");
    expect(assessDeployedRagActivation(payload, "a".repeat(7)).failures).toContain("expected_sha_invalid");
  });
  it.each([
    ["configuredMode", "legacy"],
    ["candidatePercentage", 50],
    ["retrieval", { governedRetrievalEnabled: false, mode: "legacy" }],
    ["components", { adaptiveAnswer: true, adaptiveRender: false }],
    ["versions", { adaptiveProducerAvailable: false, adaptiveRendererAvailable: true }],
    ["fullRollout", undefined],
    [
      "fullRollout",
      {
        eligible: true,
        adaptiveAnswer: true,
        adaptiveRender: true,
        generationProviderAvailable: false,
        reason: "enabled",
      },
    ],
    [
      "fullRollout",
      { eligible: true, adaptiveAnswer: true, adaptiveRender: false, reason: "adaptive_render_disabled" },
    ],
    ["audiences", { guests: "legacy", authenticated: "owner-cohort-or-full-rollout" }],
  ])("rejects healthy boot with an inactive %s", (field, value) => {
    expect(
      assessDeployedRagActivation({ ...payload, ragProgramme: { ...payload.ragProgramme, [field]: value } }, sha).ok,
    ).toBe(false);
  });
  it("authenticates one bounded probe without allowing token redirects or printing payloads", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
    const result = await checkDeployedRagActivation(environment, fetcher);
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://example.test/api/health?deep=1"),
      expect.objectContaining({
        redirect: "error",
        cache: "no-store",
        headers: { "x-health-deep-token": environment.HEALTH_DEEP_PROBE_SECRET },
      }),
    );
    expect(JSON.stringify(result)).not.toContain(environment.HEALTH_DEEP_PROBE_SECRET);
  });
  it.each([
    "http://example.test",
    "https://user:secret@example.test",
    "https://example.test?token=secret",
    "https://example.test/path",
  ])("rejects unsafe origin %s before sending credentials", async (url) => {
    const fetcher = vi.fn();
    expect(
      (await checkDeployedRagActivation({ ...environment, DEPLOY_ACTIVATION_URL: url }, fetcher)).failures,
    ).toEqual(["activation_origin_invalid"]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails with bounded machine-readable reasons on auth/network/JSON failure", async () => {
    expect(
      (
        await checkDeployedRagActivation(
          environment,
          vi.fn().mockResolvedValue(new Response("private", { status: 403 })),
        )
      ).failures,
    ).toEqual(["health_http_failure"]);
    const result = await checkDeployedRagActivation(
      environment,
      vi.fn().mockRejectedValue(new Error("private-test-token")),
    );
    expect(result).toEqual({ ok: false, check: "deployed-rag-activation", failures: ["health_probe_failed"] });
    expect((await checkDeployedRagActivation(environment, vi.fn().mockResolvedValue(new Response("private")))).ok).toBe(
      false,
    );
  });
});
