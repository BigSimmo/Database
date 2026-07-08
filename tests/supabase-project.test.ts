import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkSupabaseProjectConfig,
  expectedSupabaseProject,
  extractSupabaseProjectRef,
  formatSupabaseProjectCheck,
  staleSupabaseProjects,
} from "../src/lib/supabase/project";

const staleProject = staleSupabaseProjects[0];

describe("Supabase project guard", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("extracts the project ref from a Supabase project URL", () => {
    expect(extractSupabaseProjectRef(expectedSupabaseProject.url)).toBe(expectedSupabaseProject.ref);
    expect(extractSupabaseProjectRef("https://example.com")).toBeNull();
  });

  it("accepts the live Clinical KB Database project values", () => {
    const check = checkSupabaseProjectConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
        SUPABASE_PROJECT_REF: expectedSupabaseProject.ref,
        SUPABASE_PROJECT_NAME: expectedSupabaseProject.name,
      },
      { requireMetadata: true },
    );

    expect(check.status).toBe("ready");
    expect(formatSupabaseProjectCheck(check)).toContain(expectedSupabaseProject.name);
  });

  it("warns when the live URL is missing explicit local project metadata", () => {
    const check = checkSupabaseProjectConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
      },
      { requireMetadata: true },
    );

    expect(check.status).toBe("warning");
    expect(check.warnings.join(" ")).toContain("SUPABASE_PROJECT_REF");
    expect(check.warnings.join(" ")).toContain("SUPABASE_PROJECT_NAME");
  });

  it("rejects the older unused Supabase project", () => {
    const check = checkSupabaseProjectConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: staleProject.url,
        SUPABASE_PROJECT_REF: staleProject.ref,
        SUPABASE_PROJECT_NAME: staleProject.name,
      },
      { requireMetadata: true },
    );

    expect(check.status).toBe("mismatch");
    expect(check.staleProject?.ref).toBe(staleProject.ref);
    expect(formatSupabaseProjectCheck(check)).toContain("older unused project");
  });

  const stagingRef = "abcdefghijklmnopqrst";
  const stagingProject = {
    url: `https://${stagingRef}.supabase.co`,
    ref: stagingRef,
    name: "Clinical KB Staging",
  };

  it("accepts an explicitly declared staging project", () => {
    const check = checkSupabaseProjectConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: stagingProject.url,
        SUPABASE_PROJECT_REF: stagingProject.ref,
        SUPABASE_PROJECT_NAME: stagingProject.name,
        SUPABASE_STAGING_PROJECT_REF: stagingProject.ref,
        SUPABASE_STAGING_PROJECT_NAME: stagingProject.name,
      },
      { requireMetadata: true },
    );

    expect(check.status).toBe("ready");
    expect(check.observed.environment).toBe("staging");
    expect(check.expected.ref).toBe(stagingProject.ref);
    expect(formatSupabaseProjectCheck(check)).toContain(stagingProject.name);
  });

  it("keeps production behavior unchanged even when a staging project is declared", () => {
    const check = checkSupabaseProjectConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
        SUPABASE_PROJECT_REF: expectedSupabaseProject.ref,
        SUPABASE_PROJECT_NAME: expectedSupabaseProject.name,
        SUPABASE_STAGING_PROJECT_REF: stagingProject.ref,
        SUPABASE_STAGING_PROJECT_NAME: stagingProject.name,
      },
      { requireMetadata: true },
    );

    expect(check.status).toBe("ready");
    expect(check.observed.environment).toBe("production");
    expect(check.expected.ref).toBe(expectedSupabaseProject.ref);
  });

  it("rejects a staging declaration that collides with the production ref (silent-point-at-prod footgun)", () => {
    const check = checkSupabaseProjectConfig({
      NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
      SUPABASE_STAGING_PROJECT_REF: expectedSupabaseProject.ref,
      SUPABASE_STAGING_PROJECT_NAME: "Clinical KB Staging",
    });

    expect(check.status).toBe("mismatch");
    expect(check.problems.join(" ")).toContain("collides with the production");
  });

  it("rejects a partial staging declaration (only one of the two vars set)", () => {
    const check = checkSupabaseProjectConfig({
      NEXT_PUBLIC_SUPABASE_URL: expectedSupabaseProject.url,
      SUPABASE_PROJECT_REF: expectedSupabaseProject.ref,
      SUPABASE_PROJECT_NAME: expectedSupabaseProject.name,
      SUPABASE_STAGING_PROJECT_REF: stagingRef,
    });

    expect(check.status).toBe("mismatch");
    expect(check.problems.join(" ")).toContain("BOTH");
  });

  it("blocks server env when configured for a stale project ref", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", staleProject.url);
    vi.stubEnv("SUPABASE_PROJECT_REF", staleProject.ref);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    const { requireServerEnv } = await import("../src/lib/env");

    expect(() => requireServerEnv()).toThrow(/Supabase project mismatch/);
  });
});
