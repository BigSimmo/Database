import { afterEach, describe, expect, it, vi } from "vitest";

import {
  crossTenantDocumentIds,
  crossTenantFixtureMarker,
  readCrossTenantStagingConfig,
} from "../scripts/test-cross-tenant-staging";
import { analyzeClinicalQuery } from "../src/lib/clinical-search";
import { shouldApplyUnsupportedSearchShortCircuit } from "../src/lib/rag-retrieval-variants";

const validConfig = {
  CROSS_TENANT_STAGING_APP_URL: "https://clinical-kb-staging.tests.invalid",
  CROSS_TENANT_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  CROSS_TENANT_PROJECT_REF: "abcdefghijklmnopqrst",
  CROSS_TENANT_PUBLISHABLE_KEY: "staging-publishable-key",
  CROSS_TENANT_SERVICE_ROLE_KEY: "staging-service-role-key",
  CROSS_TENANT_USER_A_EMAIL: "tenancy-a@tests.invalid",
  CROSS_TENANT_USER_A_PASSWORD: "staging-a-password",
  CROSS_TENANT_USER_B_EMAIL: "tenancy-b@tests.invalid",
  CROSS_TENANT_USER_B_PASSWORD: "staging-b-password",
} as const;

function stubConfig(overrides: Partial<Record<keyof typeof validConfig, string>> = {}) {
  for (const [key, value] of Object.entries({ ...validConfig, ...overrides })) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cross-tenant staging configuration safety", () => {
  it("uses a unique clinically anchored marker that reaches lexical retrieval", () => {
    const marker = crossTenantFixtureMarker("12345678-1234-4234-8234-123456789abc", "a");
    const analysis = analyzeClinicalQuery(marker);

    expect(marker).toBe("lithium tenancyprobe123456781234a");
    expect(shouldApplyUnsupportedSearchShortCircuit(marker, analysis)).toBe(false);
  });

  it("prefers document_id over a chunk id in search and answer sources", () => {
    expect(crossTenantDocumentIds([{ id: "chunk-id", document_id: "document-id" }], "sources")).toEqual([
      "document-id",
    ]);
  });

  it("accepts a dedicated, internally consistent staging configuration", () => {
    stubConfig();
    expect(readCrossTenantStagingConfig()).toMatchObject({
      projectRef: "abcdefghijklmnopqrst",
      documentBucket: "clinical-documents",
    });
  });

  it("rejects the production project before clients or fixtures are created", () => {
    stubConfig({
      CROSS_TENANT_PROJECT_REF: "sjrfecxgysukkwxsowpy",
      CROSS_TENANT_SUPABASE_URL: "https://sjrfecxgysukkwxsowpy.supabase.co",
    });
    expect(() => readCrossTenantStagingConfig()).toThrow(/Refusing.*production Supabase project/);
  });

  it("rejects a URL/ref mismatch, placeholders, and duplicate users", () => {
    stubConfig({ CROSS_TENANT_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" });
    expect(() => readCrossTenantStagingConfig()).toThrow(/does not match/);

    stubConfig({ CROSS_TENANT_SERVICE_ROLE_KEY: "replace-with-staging-key" });
    expect(() => readCrossTenantStagingConfig()).toThrow(/placeholder/);

    stubConfig({ CROSS_TENANT_USER_B_EMAIL: validConfig.CROSS_TENANT_USER_A_EMAIL });
    expect(() => readCrossTenantStagingConfig()).toThrow(/different users/);
  });

  it("rejects a shared password across distinct test users", () => {
    stubConfig({ CROSS_TENANT_USER_B_PASSWORD: validConfig.CROSS_TENANT_USER_A_PASSWORD });

    expect(() => readCrossTenantStagingConfig()).toThrow(/distinct passwords/);
  });
});
