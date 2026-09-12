import { describe, expect, it } from "vitest";
import type { SearchChunksArgs } from "../src/lib/rag/rag-contracts";
import { ragCacheKeyMatchesOwner } from "../src/lib/rag/rag-cache-utils";

describe("ragCacheKeyMatchesOwner", () => {
  it("P12B Task4 versions the available adaptive renderer inside candidate cache identity", async () => {
    const { decideRagProgrammeRollout, ragProgrammeVersions } = await import("../src/lib/rag/rag-rollout");
    expect(ragProgrammeVersions).toMatchObject({
      render: "adaptive-answer-surface-v1",
      adaptiveRendererAvailable: true,
    });
    const decision = decideRagProgrammeRollout({
      configuredMode: "canary",
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      canaryBasisPoints: 10000,
      serverSalt: "private-salt-012345678901234567890123456789",
      queryPlanVersion: "v1",
      sourcePolicyVersion: "v1",
      indexGeneration: "v1",
      publicSiteContentReleaseId: null,
      publicSiteContentStaticManifestDigest: null,
      publicSiteContentReleaseDigest: null,
      publicSiteContentChangeEpoch: null,
      publicSiteContentState: "unavailable",
      siteContentEnabled: false,
      australianAugmentationEnabled: false,
      adaptiveAnswerEnabled: true,
      adaptiveRenderEnabled: true,
    });
    expect(decision.components).toMatchObject({ adaptiveAnswer: true, adaptiveRender: true });
    expect(decision.cacheNamespace).toMatch(/^rag-candidate:/);
    expect(decision.cacheNamespace).not.toBe("legacy");
  });

  it("P09 candidate fingerprints bind the same decision across answer, search and coalescing keys", async () => {
    const { decideRagProgrammeRollout } = await import("../src/lib/rag/rag-rollout");
    const { withRagRequestContext } = await import("../src/lib/rag/rag-context-snapshot");
    const cache = await import("../src/lib/rag/rag-cache");
    const request: SearchChunksArgs = { query: "Compare lithium in adults", ownerId: "private-owner" };
    const base = withRagRequestContext(request);
    const input = {
      configuredMode: "canary" as const,
      ownerId: "private-owner",
      canaryBasisPoints: 10000,
      serverSalt: "private-salt-012345678901234567890123456789",
      queryPlanVersion: "v1",
      sourcePolicyVersion: "v1",
      indexGeneration: "v1",
      publicSiteContentReleaseId: null,
      publicSiteContentStaticManifestDigest: null,
      publicSiteContentReleaseDigest: null,
      publicSiteContentChangeEpoch: null,
      publicSiteContentState: "unavailable" as const,
      siteContentEnabled: false,
      australianAugmentationEnabled: false,
      adaptiveAnswerEnabled: false,
      adaptiveRenderEnabled: false,
    };
    const a = { ...base, ragProgrammeRollout: decideRagProgrammeRollout(input) };
    const b = { ...base, ragProgrammeRollout: decideRagProgrammeRollout({ ...input, adaptiveRenderEnabled: true }) };
    for (const key of [
      cache.ragCacheFingerprint,
      cache.sharedAnswerNormalizedQuery,
      cache.scopedAnswerCacheKey,
      cache.retrievalPlanCacheQuery,
      cache.scopedSearchCacheKey,
    ]) {
      expect(key(a)).not.toBe(key(b));
      expect(key(a)).not.toContain("private-owner");
      expect(key(a)).not.toContain("private-salt");
    }
    const changed = { ...a, query: "Compare lithium in children" };
    expect(cache.retrievalPlanCacheQuery(a)).not.toBe(cache.retrievalPlanCacheQuery(changed));
  });
  const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("matches versioned scoped cache keys", () => {
    const key = `rag-cache-v13|${ownerId}|scope:all|plan:hybrid|class:dose`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches indexing-version cache keys", () => {
    const key = `${ownerId}|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches owner-plus-public cache keys", () => {
    const key = `rag-cache-v13|owner:${ownerId}+public|scope:all|plan:hybrid`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("matches owner-plus-public indexing-version keys", () => {
    const key = `owner:${ownerId}+public|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(true);
  });

  it("does not match a different owner", () => {
    const key = `rag-cache-v13|bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(false);
  });

  it("does not match an owner id prefix", () => {
    const key = `rag-cache-v13|owner:${ownerId}0+public|scope:all`;
    expect(ragCacheKeyMatchesOwner(key, ownerId)).toBe(false);
  });
});
