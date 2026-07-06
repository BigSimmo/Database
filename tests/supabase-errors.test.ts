import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSupabaseApiKeyConfigurationError,
  nonProductionSupabaseDemoFallbackReason,
} from "../src/lib/supabase/errors";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase API key configuration error detection", () => {
  it.each([
    "Unregistered API key",
    "Invalid API key",
    // Confirmed live 2026-07-06 after key rotation: legacy anon/service_role
    // JWTs disabled on 2026-07-05 produce this exact message.
    "Legacy API keys are disabled",
    "Secret API key required",
  ])("matches %j", (message) => {
    expect(isSupabaseApiKeyConfigurationError(new Error(message))).toBe(true);
    expect(isSupabaseApiKeyConfigurationError({ message })).toBe(true);
  });

  it.each(["JWT expired", "row-level security violation", "network timeout"])(
    "does not match unrelated error %j",
    (message) => {
      expect(isSupabaseApiKeyConfigurationError(new Error(message))).toBe(false);
    },
  );

  it("maps disabled legacy keys to the demo fallback reason outside production", () => {
    expect(nonProductionSupabaseDemoFallbackReason(new Error("Legacy API keys are disabled"))).toBe(
      "supabase_api_key_configuration_unavailable",
    );
  });

  it("never returns a fallback reason in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(nonProductionSupabaseDemoFallbackReason(new Error("Legacy API keys are disabled"))).toBeNull();
  });
});
