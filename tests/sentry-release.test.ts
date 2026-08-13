import { describe, expect, it } from "vitest";

import { resolveDeploymentCommitSha, resolveSentryRelease } from "@/lib/observability/sentry-release";

const railwaySha = "2ae5a0aa5d339a7dc9089db134c2d9d0220444ae";

describe("Sentry release resolution", () => {
  it("prefers explicit release configuration", () => {
    expect(resolveSentryRelease({ SENTRY_RELEASE: "release-42", RAILWAY_GIT_COMMIT_SHA: railwaySha })).toBe(
      "release-42",
    );
  });

  it("uses Railway's deployment commit instead of the opaque dev fallback", () => {
    expect(resolveSentryRelease({ RAILWAY_GIT_COMMIT_SHA: railwaySha })).toBe(railwaySha);
    expect(resolveSentryRelease({})).toBe("dev");
  });

  it("exposes only a validated full commit SHA as deployment identity", () => {
    expect(resolveDeploymentCommitSha({ RAILWAY_GIT_COMMIT_SHA: railwaySha.toUpperCase() })).toBe(railwaySha);
    expect(resolveDeploymentCommitSha({ RAILWAY_GIT_COMMIT_SHA: "not-a-sha", SENTRY_RELEASE: "release-42" })).toBe(
      null,
    );
  });
});
