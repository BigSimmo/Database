import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decideRagProgrammeRollout,
  adaptiveAnswerRenderAllowed,
  ragProgrammeVersions,
  ragProgrammeHealth,
  withRagProgrammeRollout,
  type RagProgrammeRolloutInput,
} from "../src/lib/rag/rag-rollout";
import { ragCacheFingerprint, retrievalPlanCacheQuery } from "../src/lib/rag/rag-cache";
import {
  createSearchTiming,
  startShadowSearch,
  closeShadowSearch,
  finishSearch,
} from "../src/lib/rag/rag-search-timing";
import type { SearchTelemetry, SearchChunksArgs } from "../src/lib/rag/rag-contracts";

const input: RagProgrammeRolloutInput = {
  configuredMode: "canary",
  ownerId: "private-owner-canary",
  canaryBasisPoints: 10000,
  serverSalt: "private-server-salt-01234567890123456789",
  queryPlanVersion: "query-v1",
  sourcePolicyVersion: "policy-v1",
  indexGeneration: "index-v1",
  publicSiteContentReleaseId: "11111111-1111-5111-8111-111111111111",
  publicSiteContentStaticManifestDigest: "a".repeat(64),
  publicSiteContentReleaseDigest: "b".repeat(64),
  publicSiteContentChangeEpoch: "7",
  publicSiteContentState: "current",
  governedRetrievalEnabled: true,
  siteContentEnabled: true,
  australianAugmentationEnabled: true,
  adaptiveAnswerEnabled: false,
  adaptiveRenderEnabled: false,
};
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});
describe("programme rollout truth table", () => {
  it("reuses one issued decision through nested scope normalization and restores its component projection", async () => {
    vi.resetModules();
    vi.stubEnv("RAG_PROGRAMME_MODE", "canary");
    vi.stubEnv("RAG_PROGRAMME_CANARY_BASIS_POINTS", "10000");
    vi.stubEnv("RAG_PROGRAMME_ROLLOUT_SALT", "synthetic-rollout-salt-01234567890123456789");
    vi.stubEnv("RAG_GOVERNED_RETRIEVAL_ENABLED", "true");
    const { withRagProgrammeRollout: resolve } = await import("../src/lib/rag/rag-rollout");
    const { env } = await import("../src/lib/env");
    const { retrievalAccessScopeForArgs } = await import("../src/lib/owner-scope");
    const request = resolve({
      query: "What is clozapine?",
      ownerId: "owner-a",
      allowGlobalSearch: true,
      observationContext: { interactionId: "opaque-id", rolloutMode: "shadow" as const },
    });
    env.RAG_PROGRAMME_MODE = "legacy";
    const nested = resolve({
      ...request,
      accessScope: retrievalAccessScopeForArgs(request),
      ragQueryPlanMode: "shadow" as const,
      governedCorpusComponents: { siteContent: true, australianAugmentation: true, australianCurrent: true },
    });
    expect(nested.ragProgrammeRollout).toBe(request.ragProgrammeRollout);
    expect(nested.ragQueryPlanMode).toBe("canary");
    expect(nested.observationContext.rolloutMode).toBe("canary");
    expect(nested.governedCorpusComponents).toEqual({
      siteContent: false,
      australianAugmentation: false,
      australianCurrent: false,
    });
    expect(() => resolve({ ...nested, ownerId: "owner-b" })).toThrow(
      "Retrieval access scope owner does not match ownerId",
    );
    const other = resolve({ ...nested, ownerId: "owner-b", accessScope: undefined });
    expect(other.ragProgrammeRollout).not.toBe(request.ragProgrammeRollout);
    expect(other.ragQueryPlanMode).toBe("legacy");
  });
  it.each([
    ["RAG_PROGRAMME_MODE", "invalid"],
    ["RAG_PROGRAMME_CANARY_BASIS_POINTS", "10001"],
    ["RAG_SITE_CONTENT_ENABLED", "yes"],
    ["RAG_GOVERNED_RETRIEVAL_ENABLED", "yes"],
    ["RAG_PROGRAMME_ROLLOUT_SALT", "short"],
  ])("malformed server %s cannot activate any component", async (field, value) => {
    vi.stubEnv("RAG_PROGRAMME_MODE", "canary");
    vi.stubEnv("RAG_PROGRAMME_CANARY_BASIS_POINTS", "10000");
    vi.stubEnv("RAG_AUSTRALIAN_AUGMENTATION_ENABLED", "true");
    vi.stubEnv(field, value);
    const { env } = await import("../src/lib/env");
    expect(env.RAG_PROGRAMME_MODE).toBe("legacy");
    expect(env.RAG_AUSTRALIAN_AUGMENTATION_ENABLED).toBe(false);
    expect(env.RAG_GOVERNED_RETRIEVAL_ENABLED).toBe(false);
  });
  it("legacy and shadow retain the legacy namespace and shadow serves only legacy", () => {
    const legacy = decideRagProgrammeRollout({ ...input, configuredMode: "legacy" });
    const shadow = decideRagProgrammeRollout({ ...input, configuredMode: "shadow" });
    expect(legacy).toMatchObject({
      servedMode: "legacy",
      runShadowRetrieval: false,
      cacheNamespace: "legacy",
      cohortBucket: null,
    });
    expect(legacy.components).toEqual({
      siteContent: false,
      australianAugmentation: false,
      adaptiveAnswer: false,
      adaptiveRender: false,
    });
    expect(shadow).toMatchObject({ servedMode: "legacy", runShadowRetrieval: true, cacheNamespace: "legacy" });
  });
  it("selects stable bounded HMAC cohorts without exposing inputs", () => {
    const decision = decideRagProgrammeRollout(input);
    expect(decision).toEqual(decideRagProgrammeRollout(input));
    expect(decision.servedMode).toBe("candidate");
    expect(decision.cohortBucket).toBeGreaterThanOrEqual(0);
    expect(decision.cohortBucket).toBeLessThan(10000);
    expect(JSON.stringify(decision)).not.toContain(input.ownerId);
    expect(JSON.stringify(decision)).not.toContain(input.serverSalt);
  });
  it.each([null, "private-owner-canary"])("serves adaptive answers on legacy retrieval for owner %s", (ownerId) => {
    const decision = decideRagProgrammeRollout({
      ...input,
      ownerId,
      governedRetrievalEnabled: false,
      adaptiveAnswerEnabled: true,
      adaptiveRenderEnabled: true,
    });
    expect(decision).toMatchObject({
      servedMode: "candidate",
      retrievalMode: "legacy",
      runShadowRetrieval: false,
      components: { siteContent: false, australianAugmentation: false, adaptiveAnswer: true, adaptiveRender: true },
    });
    expect(decision.cacheNamespace).not.toBe("legacy");
    expect(adaptiveAnswerRenderAllowed(decision, ragProgrammeVersions.adaptiveAnswerContract)).toBe(true);
  });
  it("requires corpus activation for shadow retrieval and preserves legacy cache identity", () => {
    const decision = decideRagProgrammeRollout({ ...input, configuredMode: "shadow", governedRetrievalEnabled: false });
    expect(decision).toMatchObject({
      servedMode: "legacy",
      retrievalMode: "legacy",
      runShadowRetrieval: false,
      cacheNamespace: "legacy",
      components: { siteContent: false, australianAugmentation: false, adaptiveAnswer: false, adaptiveRender: false },
    });
  });
  it.each([
    { serverSalt: "short" },
    { canaryBasisPoints: -1 },
    { canaryBasisPoints: 10001 },
    { canaryBasisPoints: NaN },
    { canaryBasisPoints: 1.2 },
    { configuredMode: "invalid" },
    { governedRetrievalEnabled: "true" },
  ])("fails closed on malformed configuration %j", (change) => {
    expect(decideRagProgrammeRollout({ ...input, ...change } as RagProgrammeRolloutInput).servedMode).toBe("legacy");
  });
  it("zero percent always serves legacy", () =>
    expect(decideRagProgrammeRollout({ ...input, canaryBasisPoints: 0 }).servedMode).toBe("legacy"));
  it("releases the same configured components to guests and authenticated readers at 100 percent", () => {
    const flags = {
      ...input,
      siteContentEnabled: false,
      australianAugmentationEnabled: false,
      adaptiveAnswerEnabled: true,
      adaptiveRenderEnabled: true,
    };
    const guest = decideRagProgrammeRollout({ ...flags, ownerId: null, serverSalt: undefined });
    const authenticated = decideRagProgrammeRollout(flags);
    expect(guest.servedMode).toBe("candidate");
    expect(guest.cohortBucket).toBeNull();
    expect(guest.components).toEqual(authenticated.components);
    expect(guest.components).toEqual({
      siteContent: false,
      australianAugmentation: false,
      adaptiveAnswer: true,
      adaptiveRender: true,
    });
    expect(guest.cacheNamespace).toBe(authenticated.cacheNamespace);
    expect(decideRagProgrammeRollout({ ...flags, serverSalt: undefined }).servedMode).toBe("candidate");
  });
  it.each([0, 1, 5000, 9999])("does not invent guest cohorts at %i basis points", (canaryBasisPoints) => {
    expect(decideRagProgrammeRollout({ ...input, canaryBasisPoints, ownerId: null }).servedMode).toBe("legacy");
    expect(decideRagProgrammeRollout({ ...input, canaryBasisPoints, serverSalt: undefined }).servedMode).toBe("legacy");
    expect(decideRagProgrammeRollout({ ...input, canaryBasisPoints, serverSalt: " " }).servedMode).toBe("legacy");
  });
  it("preserves the authenticated partial cohort boundary", () => {
    const decision = decideRagProgrammeRollout({ ...input, canaryBasisPoints: 5000 });
    expect(decision.cohortBucket).not.toBeNull();
    expect(decision.servedMode).toBe(decision.cohortBucket! < 5000 ? "candidate" : "legacy");
  });
  it.each([
    [{ adaptiveAnswerEnabled: false }, true, true],
    [{ adaptiveRenderEnabled: false }, true, true],
    [{}, false, true],
    [{}, true, false],
  ] as const)("guest release cannot bypass an adaptive prerequisite %j", (change, producer, renderer) => {
    const decision = decideRagProgrammeRollout(
      { ...input, ownerId: null, adaptiveAnswerEnabled: true, adaptiveRenderEnabled: true, ...change },
      producer,
      renderer,
    );
    expect(decision.components.adaptiveRender).toBe(false);
    expect(adaptiveAnswerRenderAllowed(decision, ragProgrammeVersions.adaptiveAnswerContract)).toBe(false);
  });
  it.each([
    { queryPlanVersion: "" },
    { sourcePolicyVersion: "" },
    { indexGeneration: "" },
    { adaptiveAnswerEnabled: "true" },
  ])("guest full rollout fails closed on malformed request metadata %j", (change) => {
    expect(
      decideRagProgrammeRollout({ ...input, ownerId: null, ...change } as RagProgrammeRolloutInput).servedMode,
    ).toBe("legacy");
  });
  it("default health visibly reports why full adaptive serving is unavailable", () => {
    expect(ragProgrammeHealth().fullRollout).toMatchObject({
      eligible: false,
      adaptiveAnswer: false,
      adaptiveRender: false,
      reason: "programme_not_canary",
    });
  });
  it.each([
    ["canary", "false", "legacy", false],
    ["canary", "true", "canary", false],
    ["shadow", "false", "legacy", false],
    ["shadow", "true", "shadow", true],
  ] as const)("selects %s retrieval with corpus activation %s", async (mode, enabled, expectedMode, runShadow) => {
    vi.stubEnv("RAG_PROGRAMME_MODE", mode);
    vi.stubEnv("RAG_PROGRAMME_CANARY_BASIS_POINTS", "10000");
    vi.stubEnv("RAG_GOVERNED_RETRIEVAL_ENABLED", enabled);
    vi.stubEnv("RAG_SITE_CONTENT_ENABLED", "true");
    vi.stubEnv("RAG_AUSTRALIAN_AUGMENTATION_ENABLED", "true");
    vi.stubEnv("RAG_ADAPTIVE_ANSWER_ENABLED", "true");
    vi.stubEnv("RAG_ADAPTIVE_ANSWER_RENDER_ENABLED", "true");
    const { withRagProgrammeRollout: resolve, ragProgrammeHealth: health } = await import("../src/lib/rag/rag-rollout");
    const request = resolve({
      query: "What is clozapine?",
      ragQueryPlanMode: "canary" as const,
      governedCorpusComponents: { siteContent: true, australianAugmentation: true, australianCurrent: true },
      observationContext: { interactionId: "opaque-rollout-test", rolloutMode: "legacy" as const },
    });
    expect(request.ragQueryPlanMode).toBe(expectedMode);
    expect(request.observationContext.rolloutMode).toBe(mode === "canary" ? "canary" : expectedMode);
    expect(request.ragProgrammeRollout.runShadowRetrieval).toBe(runShadow);
    expect(request.ragProgrammeRollout.components.adaptiveAnswer).toBe(mode === "canary");
    expect(health().retrieval).toEqual({ governedRetrievalEnabled: enabled === "true", mode: expectedMode });
    if (enabled === "false") {
      expect(request.governedCorpusComponents).toBeUndefined();
      expect(health().components).toMatchObject({ siteContent: false, australianAugmentation: false });
      expect(health().augmentationHealth).toBe("disabled");
      const nested = resolve({ ...request, ragQueryPlanMode: "canary" as const });
      expect(nested.ragProgrammeRollout).toBe(request.ragProgrammeRollout);
      expect(nested.ragQueryPlanMode).toBe("legacy");
    } else {
      expect(request.governedCorpusComponents).toMatchObject({ australianAugmentation: true, australianCurrent: true });
    }
  });
  it("full rollout leaves guest public scope and private-owner isolation unchanged", async () => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    vi.stubEnv("RAG_PROVIDER_MODE", "auto");
    vi.stubEnv("RAG_PROGRAMME_MODE", "canary");
    vi.stubEnv("RAG_PROGRAMME_CANARY_BASIS_POINTS", "10000");
    vi.stubEnv("RAG_ADAPTIVE_ANSWER_ENABLED", "true");
    vi.stubEnv("RAG_ADAPTIVE_ANSWER_RENDER_ENABLED", "true");
    const { withRagProgrammeRollout: resolve, ragProgrammeHealth: health } = await import("../src/lib/rag/rag-rollout");
    const { retrievalAccessScopeForArgs, retrievalAccessScopeMatchesOwner } = await import("../src/lib/owner-scope");
    const guest = resolve<SearchChunksArgs>({ query: "What is clozapine?" });
    const scope = retrievalAccessScopeForArgs(guest);
    expect(scope).toEqual({ includePublic: true });
    expect(retrievalAccessScopeMatchesOwner(scope, "private-owner")).toBe(false);
    expect(guest).not.toHaveProperty("ownerId");
    expect(guest.ragProgrammeRollout.servedMode).toBe("candidate");
    expect(guest.ragQueryPlanMode).toBe("legacy");
    expect(guest.governedCorpusComponents).toBeUndefined();
    const owned = resolve<SearchChunksArgs>({ query: "What is clozapine?", ownerId: "private-owner" });
    expect(retrievalAccessScopeForArgs(owned)).toEqual({ ownerId: "private-owner", includePublic: true });
    expect(owned.ragQueryPlanMode).toBe("legacy");
    expect(owned.ragProgrammeRollout.cacheNamespace).toBe(guest.ragProgrammeRollout.cacheNamespace);
    expect(health().retrieval).toEqual({ governedRetrievalEnabled: false, mode: "legacy" });
    expect(health().fullRollout).toEqual({
      eligible: true,
      adaptiveAnswer: false,
      adaptiveRender: false,
      generationProviderAvailable: true,
      coverageContractAvailable: false,
      reason: "governed_coverage_contract_unavailable",
    });
    const { env } = await import("../src/lib/env");
    env.RAG_ADAPTIVE_ANSWER_ENABLED = false;
    expect(health().fullRollout.reason).toBe("adaptive_answer_disabled");
  });
  it.each([
    ["offline", "synthetic-key", false],
    ["offline", "", false],
    ["auto", "", false],
    ["auto", "synthetic-key", true],
    ["openai", "synthetic-key", true],
  ])("reports effective generation availability for %s provider configuration", async (mode, key, available) => {
    vi.stubEnv("RAG_GOVERNED_RETRIEVAL_ENABLED", "true");
    vi.stubEnv("RAG_PROGRAMME_MODE", "canary");
    vi.stubEnv("RAG_PROGRAMME_CANARY_BASIS_POINTS", "10000");
    vi.stubEnv("RAG_ADAPTIVE_ANSWER_ENABLED", "true");
    vi.stubEnv("RAG_ADAPTIVE_ANSWER_RENDER_ENABLED", "true");
    vi.stubEnv("RAG_PROVIDER_MODE", mode as string);
    vi.stubEnv("OPENAI_API_KEY", key as string);
    const { ragProgrammeHealth: health } = await import("../src/lib/rag/rag-rollout");
    expect(health().fullRollout).toMatchObject({
      generationProviderAvailable: available,
      adaptiveAnswer: available,
      adaptiveRender: available,
      reason: available ? "enabled" : "generation_provider_unavailable",
    });
  });
  it.each([
    "queryPlanVersion",
    "sourcePolicyVersion",
    "indexGeneration",
    "publicSiteContentReleaseId",
    "publicSiteContentStaticManifestDigest",
    "publicSiteContentReleaseDigest",
    "publicSiteContentChangeEpoch",
  ] as const)("isolates changed %s", (field) => {
    expect(decideRagProgrammeRollout({ ...input, [field]: "changed" }).cacheNamespace).not.toBe(
      decideRagProgrammeRollout(input).cacheNamespace,
    );
  });
  it.each([
    "governedRetrievalEnabled",
    "siteContentEnabled",
    "australianAugmentationEnabled",
    "adaptiveAnswerEnabled",
    "adaptiveRenderEnabled",
  ] as const)("isolates every configured flag including %s", (field) => {
    expect(decideRagProgrammeRollout({ ...input, [field]: !input[field] }).cacheNamespace).not.toBe(
      decideRagProgrammeRollout(input).cacheNamespace,
    );
  });
  it("does not partition public candidate semantics by cohort identity", () => {
    expect(decideRagProgrammeRollout({ ...input, ownerId: "different-owner" }).cacheNamespace).toBe(
      decideRagProgrammeRollout(input).cacheNamespace,
    );
  });
  it.each(["stale", "unavailable", "disabled"] as const)(
    "fails closed on %s site state without disabling Australian scope",
    (publicSiteContentState) => {
      expect(decideRagProgrammeRollout({ ...input, publicSiteContentState }).components).toMatchObject({
        siteContent: false,
        australianAugmentation: true,
      });
    },
  );
  it("pending site updates remain eligible and isolate their epoch", () => {
    const pending = decideRagProgrammeRollout({
      ...input,
      publicSiteContentState: "updating",
      publicSiteContentChangeEpoch: "8",
    });
    expect(pending.components.siteContent).toBe(true);
    expect(pending.cacheNamespace).not.toBe(decideRagProgrammeRollout(input).cacheNamespace);
  });
  it("keeps disabled site release changes outside candidate identity", () => {
    const disabled = { ...input, siteContentEnabled: false };
    expect(decideRagProgrammeRollout({ ...disabled, publicSiteContentChangeEpoch: "8" }).cacheNamespace).toBe(
      decideRagProgrammeRollout(disabled).cacheNamespace,
    );
  });
  it.each(["legacy", "shadow", "canary"] as const)(
    "requires literal final v20 and both flags in %s",
    (configuredMode) => {
      for (const adaptiveAnswerEnabled of [false, true])
        for (const adaptiveRenderEnabled of [false, true]) {
          const decision = decideRagProgrammeRollout({
            ...input,
            configuredMode,
            adaptiveAnswerEnabled,
            adaptiveRenderEnabled,
          });
          expect(adaptiveAnswerRenderAllowed(decision, "clinical-rag-answer-v20")).toBe(
            configuredMode === "canary" && adaptiveAnswerEnabled && adaptiveRenderEnabled,
          );
          const unavailable = decideRagProgrammeRollout(
            { ...input, configuredMode, adaptiveAnswerEnabled, adaptiveRenderEnabled },
            true,
            false,
          );
          expect(adaptiveAnswerRenderAllowed(unavailable, "clinical-rag-answer-v20")).toBe(false);
          for (const rejected of [
            undefined,
            "clinical-rag-answer-v19",
            "rag-adaptive-answer-v1",
            "rag-programme-gate-v1",
            "legacy",
          ])
            expect(adaptiveAnswerRenderAllowed(decision, rejected)).toBe(false);
        }
      expect(ragProgrammeVersions.prompt).toBe("clinical-rag-answer-v19");
      expect(ragProgrammeVersions.schema).toBe("clinical-rag-answer-schema-v4");
      expect(ragProgrammeVersions.adaptiveProducerAvailable).toBe(true);
      expect(ragProgrammeVersions.adaptiveRendererAvailable).toBe(true);
    },
  );
  it("default environment ignores internal activation hints and preserves legacy keys", () => {
    const args = {
      query: "What does PHQ-9 mean?",
      ragQueryPlanMode: "canary" as const,
      governedCorpusComponents: { siteContent: true, australianAugmentation: true, australianCurrent: true },
    };
    const normalized = withRagProgrammeRollout(args);
    expect(normalized.ragQueryPlanMode).toBe("legacy");
    expect(normalized.governedCorpusComponents).toBeUndefined();
    const control = { ...normalized, ragProgrammeRollout: undefined };
    expect(ragCacheFingerprint(normalized)).toBe(ragCacheFingerprint(control));
    expect(retrievalPlanCacheQuery(normalized)).toBe(retrievalPlanCacheQuery(control));
  });
  it("shadow retains actual legacy answer and search key identity", () => {
    const legacy = withRagProgrammeRollout({ query: "What is clozapine?" });
    const shadow = {
      ...legacy,
      ragQueryPlanMode: "shadow" as const,
      ragProgrammeRollout: decideRagProgrammeRollout({ ...input, configuredMode: "shadow" }),
      governedCorpusComponents: { siteContent: true, australianAugmentation: true, australianCurrent: true },
    };
    expect(ragCacheFingerprint(shadow)).toBe(ragCacheFingerprint(legacy));
    expect(retrievalPlanCacheQuery(shadow)).toBe(retrievalPlanCacheQuery(legacy));
  });
  it("records completed shadow diagnostics without holding the parent signal listener", async () => {
    const timing = createSearchTiming();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    startShadowSearch(timing, controller.signal, async () => ({ candidateResults: [] }));
    await vi.waitFor(() => expect(timing.shadowState).toBe("completed"));
    const response = finishSearch(timing, { results: [], telemetry: {} as SearchTelemetry });
    expect(response.telemetry.shadow_retrieval_state).toBe("completed");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(controller.signal.aborted).toBe(false);
  });
  it("consumes synchronous candidate failure and cleans up on caller abort", async () => {
    const failed = createSearchTiming();
    startShadowSearch(failed, undefined, () => {
      throw new Error("PRIVATE_FAILURE");
    });
    await vi.waitFor(() => expect(failed.shadowState).toBe("failed"));
    closeShadowSearch(failed);
    const controller = new AbortController();
    const timing = createSearchTiming();
    let child: AbortSignal | undefined;
    startShadowSearch(timing, controller.signal, (signal) => {
      child = signal;
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("PRIVATE_ABORT")), { once: true }),
      );
    });
    await Promise.resolve();
    controller.abort();
    closeShadowSearch(timing);
    await Promise.resolve();
    await Promise.resolve();
    expect(child?.aborted).toBe(true);
    expect(timing.shadowState).toBe("cancelled");
    expect(JSON.stringify(timing)).not.toMatch(/PRIVATE_FAILURE|PRIVATE_ABORT/);
  });
});

it("unavailable producer prevents both generation and rendering despite configured flags", () => {
  const decision = decideRagProgrammeRollout(
    { ...input, adaptiveAnswerEnabled: true, adaptiveRenderEnabled: true },
    false,
  );
  expect(decision.components.adaptiveAnswer).toBe(false);
  expect(decision.components.adaptiveRender).toBe(false);
  expect(adaptiveAnswerRenderAllowed(decision, "clinical-rag-answer-v20")).toBe(false);
});

it("P12A availability changes isolate candidate component identity while preserving legacy", () => {
  const flags = { ...input, adaptiveAnswerEnabled: true, adaptiveRenderEnabled: true };
  const unavailable = decideRagProgrammeRollout(flags, true, false);
  const available = decideRagProgrammeRollout(flags);
  expect(unavailable.components.adaptiveRender).toBe(false);
  expect(available.components.adaptiveRender).toBe(true);
  expect(unavailable.cacheNamespace).not.toBe(available.cacheNamespace);
  expect(decideRagProgrammeRollout({ ...flags, configuredMode: "legacy" }, false, false).cacheNamespace).toBe("legacy");
  expect(decideRagProgrammeRollout({ ...flags, configuredMode: "legacy" }, true, true).cacheNamespace).toBe("legacy");
});
