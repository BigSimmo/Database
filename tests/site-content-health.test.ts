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
const retainedBootstrapReleaseId = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
const retainedBootstrapDigest = "57f6ec90225fc4341b446705f50a48b132f2872172d8f93888bf921fe7bfa1bc";

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

const retainedBootstrapRelease = {
  version: "clinical-kb-site-release-v1" as const,
  releaseId: retainedBootstrapReleaseId,
  registryVersion: "site-content-bootstrap-public-release-v1",
  staticManifestDigest: "0".repeat(64),
  dynamicStateDigest: retainedBootstrapDigest,
  releaseDigest: retainedBootstrapDigest,
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
    activePublicSiteRelease: release,
    publicSiteChangeEpoch: "7",
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

function releaseEvidence() {
  return {
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
}

describe("site-content partition classification", () => {
  it("never treats the retained-bootstrap sentinel as a deployable partition digest", () => {
    for (const expectedSiteStaticManifestDigest of [undefined, "0".repeat(64), "f".repeat(64)]) {
      const partition = classifySiteContentPartition({
        expectedSiteStaticManifestDigest,
        activePublicSiteRelease: retainedBootstrapRelease,
        publicSiteChangeEpoch: "0",
        pendingPublicSiteChangeCount: 0,
      });
      expect(partition.state).toBe("unavailable");
      expect(partition.staticMatches).toBe(false);
    }
  });

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

  it("fails closed when an initialized control plane has all partition evidence absent", () => {
    const partition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: undefined,
      activePublicSiteRelease: null,
      publicSiteChangeEpoch: null,
      pendingPublicSiteChangeCount: 0,
    });

    expect(classifySiteContentHealth(healthy({ partition }))).toMatchObject({
      state: "unavailable",
      ready: false,
      operationStop: true,
      reasons: ["active_release_missing", "change_epoch_invalid", "expected_static_digest_missing"],
    });
  });

  it.each([
    ["missing", null],
    ["future", "2026-08-27T00:10:00.001Z"],
  ])("fails closed on %s initialized activation evidence", (_name, lastActivation) => {
    expect(classifySiteContentHealth(healthy({ lastActivation }))).toMatchObject({
      state: "unavailable",
      ready: false,
      operationStop: true,
      reasons: ["time_integrity_invalid"],
    });
  });

  it("allows only the exact retained bootstrap override and fails closed on integrity or worker evidence", () => {
    const bootstrapPartition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: undefined,
      activePublicSiteRelease: retainedBootstrapRelease,
      publicSiteChangeEpoch: "0",
      pendingPublicSiteChangeCount: 0,
    });
    expect(
      classifySiteContentHealth(
        healthy({
          partition: bootstrapPartition,
          activePublicSiteRelease: retainedBootstrapRelease,
          publicSiteChangeEpoch: "0",
          initialized: false,
          bootstrapIntegrityState: "valid_retained",
          synchronizerSeen: false,
          lastInvocationAt: null,
          lastSuccessfulInvocationAt: null,
          latestInvocationSucceeded: false,
        }),
      ),
    ).toMatchObject({ state: "disabled", ready: true, operationStop: false });

    const contradictoryBootstrapEvidence: Array<{
      name: string;
      overrides: Partial<SiteContentHealthInput>;
    }> = [
      {
        name: "outstanding head",
        overrides: { outstandingHeadCount: 1, oldestOutstandingOriginAgeMs: 60_000 },
      },
      {
        name: "pending event",
        overrides: { outstandingHeadCount: 1, pendingCount: 1, oldestOutstandingOriginAgeMs: 60_000 },
      },
      {
        name: "retry-pending event",
        overrides: { outstandingHeadCount: 1, retryPendingCount: 1, oldestOutstandingOriginAgeMs: 60_000 },
      },
      {
        name: "processing event",
        overrides: { outstandingHeadCount: 1, processingCount: 1, oldestOutstandingOriginAgeMs: 60_000 },
      },
      {
        name: "ready event",
        overrides: { outstandingHeadCount: 1, readyCount: 1, oldestOutstandingOriginAgeMs: 60_000 },
      },
      { name: "quarantined event", overrides: { quarantinedCount: 1 } },
      { name: "broken closure", overrides: { pendingSetExact: false } },
      { name: "outstanding count disagreement", overrides: { outstandingHeadCountAgrees: false } },
      { name: "expired processing lease", overrides: { expiredProcessingLeaseCount: 1 } },
      { name: "queue age without an outstanding head", overrides: { oldestOutstandingOriginAgeMs: 60_000 } },
    ];
    for (const testCase of contradictoryBootstrapEvidence) {
      expect(
        classifySiteContentHealth(
          healthy({
            partition: bootstrapPartition,
            activePublicSiteRelease: retainedBootstrapRelease,
            publicSiteChangeEpoch: "0",
            initialized: false,
            bootstrapIntegrityState: "valid_retained",
            synchronizerSeen: false,
            lastInvocationAt: null,
            lastSuccessfulInvocationAt: null,
            latestInvocationSucceeded: false,
            ...testCase.overrides,
          }),
        ),
        testCase.name,
      ).toMatchObject({ state: "unavailable", ready: false, operationStop: true });
    }

    expect(
      classifySiteContentHealth(
        healthy({
          partition: bootstrapPartition,
          activePublicSiteRelease: retainedBootstrapRelease,
          publicSiteChangeEpoch: "0",
          initialized: false,
          bootstrapIntegrityState: "invalid",
        }),
      ),
    ).toMatchObject({ state: "unavailable", ready: false, operationStop: true });
    expect(classifySiteContentHealth(healthy({ administratorAttestationValid: false })).reasons).toContain(
      "administrator_attestation_invalid",
    );
    expect(classifySiteContentHealth(healthy({ latestInvocationSucceeded: false }))).toMatchObject({
      state: "unavailable",
      operationStop: true,
    });
    expect(classifySiteContentHealth(healthy({ populationComplete: false }))).toMatchObject({
      state: "unavailable",
      ready: false,
      operationStop: true,
      reasons: expect.arrayContaining(["population_incomplete"]),
    });
  });

  it("fails closed when valid-retained evidence does not identify the exact retained bootstrap", () => {
    const nonReservedPartition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: undefined,
      activePublicSiteRelease: release,
      publicSiteChangeEpoch: "0",
      pendingPublicSiteChangeCount: 0,
    });
    const exactBootstrapPartition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: undefined,
      activePublicSiteRelease: retainedBootstrapRelease,
      publicSiteChangeEpoch: "0",
      pendingPublicSiteChangeCount: 0,
    });
    const base = {
      initialized: false,
      bootstrapIntegrityState: "valid_retained" as const,
      synchronizerSeen: false,
      lastInvocationAt: null,
      lastSuccessfulInvocationAt: null,
      latestInvocationSucceeded: false,
    };
    const mismatches: Array<{ name: string; overrides: Partial<SiteContentHealthInput> }> = [
      {
        name: "non-reserved release",
        overrides: {
          partition: nonReservedPartition,
          activePublicSiteRelease: release,
          publicSiteChangeEpoch: "0",
        },
      },
      {
        name: "partition and active release disagreement",
        overrides: {
          partition: nonReservedPartition,
          activePublicSiteRelease: retainedBootstrapRelease,
          publicSiteChangeEpoch: "0",
        },
      },
      {
        name: "bootstrap registry identity mismatch",
        overrides: {
          partition: exactBootstrapPartition,
          activePublicSiteRelease: { ...retainedBootstrapRelease, registryVersion: "site-content-registry-v1" },
          publicSiteChangeEpoch: "0",
        },
      },
      {
        name: "bootstrap static identity mismatch",
        overrides: {
          partition: exactBootstrapPartition,
          activePublicSiteRelease: { ...retainedBootstrapRelease, staticManifestDigest: staticDigest },
          publicSiteChangeEpoch: "0",
        },
      },
      {
        name: "inactive bootstrap release",
        overrides: {
          partition: exactBootstrapPartition,
          activePublicSiteRelease: { ...retainedBootstrapRelease, state: "superseded" } as never,
          publicSiteChangeEpoch: "0",
        },
      },
      {
        name: "nonzero public epoch",
        overrides: {
          partition: exactBootstrapPartition,
          activePublicSiteRelease: retainedBootstrapRelease,
          publicSiteChangeEpoch: "1",
        },
      },
    ];

    for (const testCase of mismatches) {
      expect(classifySiteContentHealth(healthy({ ...base, ...testCase.overrides })), testCase.name).toMatchObject({
        state: "unavailable",
        ready: false,
        operationStop: true,
        reasons: expect.arrayContaining(["bootstrap_invalid"]),
      });
    }
  });

  it("retains stale only when static mismatch is the sole stopping reason", () => {
    const stalePartition = classifySiteContentPartition({
      expectedSiteStaticManifestDigest: "d".repeat(64),
      activePublicSiteRelease: release,
      publicSiteChangeEpoch: "7",
      pendingPublicSiteChangeCount: 0,
    });
    expect(classifySiteContentHealth(healthy({ partition: stalePartition }))).toMatchObject({
      state: "stale",
      operationStop: true,
    });

    const stoppingFamilies: Array<{
      name: string;
      overrides: Partial<SiteContentHealthInput>;
      reason: string;
    }> = [
      { name: "bootstrap", overrides: { bootstrapIntegrityState: "invalid" }, reason: "bootstrap_invalid" },
      { name: "population", overrides: { populationComplete: false }, reason: "population_incomplete" },
      { name: "release integrity", overrides: { releaseDigestValid: false }, reason: "release_digest_invalid" },
      { name: "dynamic integrity", overrides: { dynamicDigestValid: false }, reason: "dynamic_digest_invalid" },
      {
        name: "administrator attestation",
        overrides: { administratorAttestationValid: false },
        reason: "administrator_attestation_invalid",
      },
      { name: "governance", overrides: { governanceValid: false }, reason: "governance_invalid" },
      { name: "pending closure", overrides: { pendingSetExact: false }, reason: "pending_set_invalid" },
      {
        name: "outstanding count",
        overrides: { outstandingHeadCountAgrees: false },
        reason: "outstanding_count_mismatch",
      },
      { name: "count overflow", overrides: { countOverflow: true }, reason: "count_overflow" },
      { name: "time integrity", overrides: { timeIntegrityValid: false }, reason: "time_integrity_invalid" },
      { name: "retry", overrides: { retryPendingCount: 1 }, reason: "retry_pending_work" },
      { name: "quarantine", overrides: { quarantinedCount: 1 }, reason: "quarantined_work" },
      {
        name: "lease",
        overrides: { expiredProcessingLeaseCount: 1 },
        reason: "expired_processing_lease",
      },
      {
        name: "missing queue age",
        overrides: { outstandingHeadCount: 1, oldestOutstandingOriginAgeMs: null },
        reason: "oldest_queue_age_invalid",
      },
      {
        name: "over-age queue",
        overrides: { outstandingHeadCount: 1, oldestOutstandingOriginAgeMs: SITE_CONTENT_QUEUE_STOP_AGE_MS + 1 },
        reason: "over_age_queue",
      },
    ];

    for (const { name, overrides, reason } of stoppingFamilies) {
      const result = classifySiteContentHealth(healthy({ partition: stalePartition, ...overrides }));
      expect(result.reasons, name).toContain(reason);
      expect(result.state, name).toBe("unavailable");
      expect(result.operationStop, name).toBe(true);
    }

    const staleWithNonStoppingSlo = classifySiteContentHealth(
      healthy({
        partition: stalePartition,
        outstandingHeadCount: 1,
        oldestOutstandingOriginAgeMs: SITE_CONTENT_ACTIVATION_SLO_MS + 1,
      }),
    );
    expect(staleWithNonStoppingSlo.reasons).toContain("activation_slo_exceeded");
    expect(staleWithNonStoppingSlo.state).toBe("stale");
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
    const evidence = releaseEvidence();
    expect(parseSiteContentReleaseEvidence(evidence)).toEqual(evidence);
    expect(() => parseSiteContentReleaseEvidence({ ...evidence, workerId: "private" })).toThrow(
      "SITE_CONTENT_RELEASE_EVIDENCE_INVALID",
    );
    expect(() => parseSiteContentReleaseEvidence({ ...evidence, pendingCount: -1 })).toThrow(
      "SITE_CONTENT_RELEASE_EVIDENCE_INVALID",
    );
  });

  it("rejects impossible calendar values across every nested timestamp", () => {
    const invalidTimestamps = ["2026-02-31T00:00:00.000Z", "2026-13-01T00:00:00.000Z", "2026-01-01T25:00:00.000Z"];
    for (const field of [
      "activePublicSiteRelease.activatedAt",
      "lastInvocationAt",
      "lastSuccessfulInvocationAt",
      "lastActivation",
    ] as const) {
      for (const invalidTimestamp of invalidTimestamps) {
        const evidence = releaseEvidence();
        if (field === "activePublicSiteRelease.activatedAt") {
          evidence.activePublicSiteRelease = { ...release, activatedAt: invalidTimestamp };
        } else {
          evidence[field] = invalidTimestamp;
        }
        expect(() => parseSiteContentReleaseEvidence(evidence), `${field}: ${invalidTimestamp}`).toThrow(
          "SITE_CONTENT_RELEASE_EVIDENCE_INVALID",
        );
      }
    }
  });

  it("preserves valid leap-day, fractional, and explicit-offset timestamps", () => {
    for (const timestamp of [
      "2024-02-29T23:59:59Z",
      "2026-08-27T00:06:00.123456Z",
      "2026-08-27T08:06:00.000+08:00",
      "2026-08-26T18:36:00.000-05:30",
    ]) {
      expect(parseSiteContentReleaseEvidence({ ...releaseEvidence(), lastActivation: timestamp }).lastActivation).toBe(
        timestamp,
      );
    }
  });
});
