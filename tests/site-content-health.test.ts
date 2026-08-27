import { describe, expect, it } from "vitest";

import {
  SITE_CONTENT_ACTIVATION_SLO_MS,
  SITE_CONTENT_QUEUE_STOP_AGE_MS,
  SITE_CONTENT_WORKER_FRESH_MS,
  classifySiteContentHealth,
  classifySiteContentPartition,
  parseSiteContentReleaseEvidence,
  type SiteContentHealthInput,
} from "@/lib/site-content/site-content-health";

const now = "2026-08-27T00:10:00.000Z";
const staticDigest = "a".repeat(64);
const dynamicDigest = "b".repeat(64);
const releaseDigest = "c".repeat(64);
const releaseId = "11111111-1111-5111-8111-111111111111";

const release = {
  version: "clinical-kb-site-release-v1" as const,
  releaseId,
  registryVersion: "site-content-registry-v1",
  staticManifestDigest: staticDigest,
  dynamicStateDigest: dynamicDigest,
  releaseDigest,
  state: "active" as const,
  activatedAt: "2026-08-27T00:00:00.000Z",
};

function healthy(overrides: Partial<SiteContentHealthInput> = {}): SiteContentHealthInput {
  return {
    partition: classifySiteContentPartition({
      expectedSiteStaticManifestDigest: staticDigest,
      activePublicSiteRelease: release,
      publicSiteChangeEpoch: "7",
      pendingPublicSiteChangeCount: 0,
    }),
    now,
    initialized: true,
    bootstrapIntegrityState: "not_applicable",
    populationComplete: true,
    releaseDigestValid: true,
    dynamicDigestValid: true,
    administratorAttestationValid: true,
    governanceValid: true,
    pendingSetExact: true,
    outstandingHeadCount: 0,
    outstandingHeadCountAgrees: true,
    pendingCount: 0,
    retryPendingCount: 0,
    processingCount: 0,
    readyCount: 0,
    quarantinedCount: 0,
    oldestOutstandingOriginAgeMs: null,
    countOverflow: false,
    timeIntegrityValid: true,
    expiredProcessingLeaseCount: 0,
    synchronizerSeen: true,
    lastInvocationAt: "2026-08-27T00:06:00.000Z",
    lastSuccessfulInvocationAt: "2026-08-27T00:06:00.000Z",
    latestInvocationSucceeded: true,
    lastActivation: release.activatedAt,
    rollbackAvailable: true,
    ...overrides,
  } as SiteContentHealthInput;
}

describe("site-content partition classification", () => {
  it("owns the exact five and ten minute boundaries", () => {
    expect(SITE_CONTENT_ACTIVATION_SLO_MS).toBe(300_000);
    expect(SITE_CONTENT_QUEUE_STOP_AGE_MS).toBe(600_000);
    expect(SITE_CONTENT_WORKER_FRESH_MS).toBe(300_000);
    const updatingPartition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: staticDigest,
      activePublicSiteRelease: release,
      publicSiteChangeEpoch: "8",
      pendingPublicSiteChangeCount: 1,
    });
    const updating = (age: number) =>
      healthy({
        partition: updatingPartition,
        outstandingHeadCount: 1,
        pendingCount: 1,
        oldestOutstandingOriginAgeMs: age,
      });
    expect(classifySiteContentHealth(updating(300_000)).operationStop).toBe(false);
    expect(classifySiteContentHealth(updating(300_001)).reasons).toContain("activation_slo_exceeded");
    expect(classifySiteContentHealth(updating(600_000)).operationStop).toBe(false);
    expect(classifySiteContentHealth(updating(600_001)).operationStop).toBe(true);
  });

  it("distinguishes disabled, unavailable, stale, current, and updating without operational evidence", () => {
    expect(
      classifySiteContentPartition({
        expectedSiteStaticManifestDigest: undefined,
        activePublicSiteRelease: null,
        publicSiteChangeEpoch: null,
        pendingPublicSiteChangeCount: 0,
      }).state,
    ).toBe("disabled");
    expect(
      classifySiteContentPartition({
        expectedSiteStaticManifestDigest: staticDigest,
        activePublicSiteRelease: null,
        publicSiteChangeEpoch: null,
        pendingPublicSiteChangeCount: 0,
      }).state,
    ).toBe("unavailable");
    expect(
      classifySiteContentPartition({
        expectedSiteStaticManifestDigest: "d".repeat(64),
        activePublicSiteRelease: release,
        publicSiteChangeEpoch: "7",
        pendingPublicSiteChangeCount: 0,
      }).state,
    ).toBe("stale");
    expect(healthy().partition.state).toBe("current");
    expect(
      classifySiteContentPartition({
        expectedSiteStaticManifestDigest: staticDigest,
        activePublicSiteRelease: release,
        publicSiteChangeEpoch: "8",
        pendingPublicSiteChangeCount: 1,
      }).state,
    ).toBe("updating");
  });

  it("allows only the exact retained bootstrap override and fails closed on integrity or worker evidence", () => {
    const bootstrapPartition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: undefined,
      activePublicSiteRelease: release,
      publicSiteChangeEpoch: "0",
      pendingPublicSiteChangeCount: 0,
    });
    expect(
      classifySiteContentHealth(
        healthy({
          partition: bootstrapPartition,
          initialized: false,
          bootstrapIntegrityState: "valid_retained",
          synchronizerSeen: false,
          lastInvocationAt: null,
          lastSuccessfulInvocationAt: null,
          latestInvocationSucceeded: false,
        }),
      ),
    ).toMatchObject({ state: "disabled", ready: true, operationStop: false });
    expect(
      classifySiteContentHealth(
        healthy({ partition: bootstrapPartition, initialized: false, bootstrapIntegrityState: "invalid" }),
      ),
    ).toMatchObject({ state: "unavailable", ready: false, operationStop: true });
    expect(classifySiteContentHealth(healthy({ administratorAttestationValid: false })).reasons).toContain(
      "administrator_attestation_invalid",
    );
    expect(classifySiteContentHealth(healthy({ latestInvocationSucceeded: false }))).toMatchObject({
      state: "unavailable",
      operationStop: true,
    });
  });

  it("keeps the public projection bounded and caps only projection values", () => {
    const result = classifySiteContentHealth(
      healthy({ pendingCount: 10_001, oldestOutstandingOriginAgeMs: 90_000_000 }),
    );
    expect(result.publicProjection).toEqual({
      releaseId,
      staticMatches: true,
      releaseDigestPrefix: releaseDigest.slice(0, 12),
      state: "unavailable",
      synchronizerSeen: true,
      invocationFresh: true,
      lastSuccessfulInvocationFresh: true,
      pendingCount: 9_999,
      retryPendingCount: 0,
      processingCount: 0,
      readyCount: 0,
      failedCount: 0,
      oldestQueueAgeMs: 86_400_000,
      lastActivation: release.activatedAt,
      rollbackAvailable: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /changeEpoch|dynamicStateDigest|staticManifestDigest|publishedBy|workerId/,
    );
  });
});

describe("site-content health evidence parsing", () => {
  it("strictly parses the bounded RPC object and rejects privacy-bearing extras", () => {
    const evidence = {
      initialized: true,
      bootstrapIntegrityState: "not_applicable",
      activePublicSiteRelease: release,
      publicSiteChangeEpoch: "7",
      outstandingHeadCount: 0,
      populationComplete: true,
      releaseDigestValid: true,
      dynamicDigestValid: true,
      administratorAttestationValid: true,
      governanceValid: true,
      pendingSetExact: true,
      outstandingHeadCountAgrees: true,
      pendingCount: 0,
      retryPendingCount: 0,
      processingCount: 0,
      readyCount: 0,
      quarantinedCount: 0,
      oldestOutstandingOriginAgeMs: null,
      countOverflow: false,
      timeIntegrityValid: true,
      expiredProcessingLeaseCount: 0,
      synchronizerSeen: true,
      lastInvocationAt: "2026-08-27T00:06:00.000Z",
      lastSuccessfulInvocationAt: "2026-08-27T00:06:00.000Z",
      latestInvocationSucceeded: true,
      lastActivation: release.activatedAt,
      rollbackAvailable: true,
    };
    expect(parseSiteContentReleaseEvidence(evidence)).toEqual(evidence);
    expect(() => parseSiteContentReleaseEvidence({ ...evidence, workerId: "private" })).toThrow(
      "SITE_CONTENT_RELEASE_EVIDENCE_INVALID",
    );
    expect(() => parseSiteContentReleaseEvidence({ ...evidence, pendingCount: -1 })).toThrow(
      "SITE_CONTENT_RELEASE_EVIDENCE_INVALID",
    );
  });
});
