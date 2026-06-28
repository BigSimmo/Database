import { afterEach, describe, expect, it, vi } from "vitest";

// isDemoMode() / isLocalNoAuthMode() read frozen values from `env` (parsed at
// import time) plus live process.env.NODE_ENV, so each case re-imports the module
// with a fresh, stubbed environment. The DEMO fail-open guard (env.ts) must never
// let a production deploy with missing/mismatched Supabase config silently serve
// unauthenticated demo content.

const MATCHING_URL = "https://sjrfecxgysukkwxsowpy.supabase.co";
const STALE_PROJECT_URL = "https://qjgitjyhxrwxsrydablr.supabase.co";

const ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "NEXT_PUBLIC_LOCAL_NO_AUTH",
  "LOCAL_NO_AUTH",
] as const;

async function loadEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    vi.stubEnv(key, overrides[key]);
  }
  return import("../src/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isDemoMode production guard", () => {
  it("does not fall back to demo mode in production when Supabase config is missing", async () => {
    const { isDemoMode } = await loadEnv({ NODE_ENV: "production" });
    expect(isDemoMode()).toBe(false);
  });

  it("does not fall back to demo mode in production when the project is mismatched", async () => {
    const { isDemoMode } = await loadEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: STALE_PROJECT_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(isDemoMode()).toBe(false);
  });

  it("honors an explicit demo opt-in even in production", async () => {
    const { isDemoMode } = await loadEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_DEMO_MODE: "true",
    });
    expect(isDemoMode()).toBe(true);
  });

  it("still falls back to demo mode outside production when config is missing", async () => {
    const { isDemoMode } = await loadEnv({ NODE_ENV: "development" });
    expect(isDemoMode()).toBe(true);
  });

  it("still treats a mismatched project as demo mode outside production", async () => {
    const { isDemoMode } = await loadEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: STALE_PROJECT_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(isDemoMode()).toBe(true);
  });

  it("is not demo mode outside production when Supabase config is valid", async () => {
    const { isDemoMode } = await loadEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(isDemoMode()).toBe(false);
  });
});
