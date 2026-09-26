import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

// The boot guard (src/instrumentation.ts) must refuse to start a production server
// that is misconfigured (missing/mismatched Supabase or required OpenAI config),
// running in demo mode, or running with local no-auth enabled. Explicit offline
// mode is the only production profile that may omit OpenAI. It must be a no-op
// outside the Node.js production runtime so dev and Edge keep working. env is
// parsed at import time, so each case re-imports the module with fresh stubs.

const MATCHING_URL = "https://sjrfecxgysukkwxsowpy.supabase.co";

const ENV_KEYS = [
  "NEXT_RUNTIME",
  "NODE_ENV",
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "OPENAI_API_KEY",
  "RAG_PROVIDER_MODE",
  "RAG_QUERY_HASH_SECRET",
  "NEXT_PUBLIC_LOCAL_NO_AUTH",
  "LOCAL_NO_AUTH",
  "PLAYWRIGHT_OFFLINE_MODE",
  "NEXT_DIST_DIR",
  "CARING_CONTACTS_DEMO_ENABLED",
  "CARING_CONTACTS_DATABASE_URL",
  "CARING_CONTACTS_SESSION_HMAC_SECRET",
  "CARING_CONTACTS_SESSION_ISSUER",
  "CARING_CONTACTS_GOVERNANCE_ATTESTATION_JSON",
  "CARING_CONTACTS_GOVERNANCE_ATTESTATION_MAC",
  "CARING_CONTACTS_GOVERNANCE_HMAC_SECRET",
] as const;

async function loadInstrumentation(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    vi.stubEnv(key, overrides[key]);
  }
  return import("../src/instrumentation");
}

async function loadRegister(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  const mod = await loadInstrumentation(overrides);
  return mod.register;
}

const PRODUCTION_NODE = { NEXT_RUNTIME: "nodejs", NODE_ENV: "production" } as const;

const FULLY_CONFIGURED = {
  ...PRODUCTION_NODE,
  NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OPENAI_API_KEY: "openai-key",
  RAG_QUERY_HASH_SECRET: "test-secret-at-least-16-chars",
} as const;

// The boot warm of /api/setup-status would otherwise make real Supabase calls from every case.
const warmSetupStatus = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(async () => new Response(null)),
);
vi.mock("@/app/api/setup-status/route", () => ({ GET: warmSetupStatus }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("instrumentation boot guard", () => {
  it("refuses to start a production server with missing Supabase config", async () => {
    const register = await loadRegister({ ...PRODUCTION_NODE });
    await expect(register()).rejects.toThrow(/Missing server environment variables/);
  });

  it("refuses to start a production server in demo mode", async () => {
    const register = await loadRegister({ ...PRODUCTION_NODE, NEXT_PUBLIC_DEMO_MODE: "true" });
    await expect(register()).rejects.toThrow(/demo mode is enabled/);
  });

  it("allows only the isolated provider-free Playwright production profile", async () => {
    const valid = await loadRegister({
      ...PRODUCTION_NODE,
      PLAYWRIGHT_OFFLINE_MODE: "true",
      NEXT_DIST_DIR: ".next-playwright/123-456/dist",
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      RAG_PROVIDER_MODE: "offline",
    });
    await expect(valid()).resolves.toBeUndefined();

    const external = await loadRegister({
      ...PRODUCTION_NODE,
      PLAYWRIGHT_OFFLINE_MODE: "true",
      NEXT_DIST_DIR: ".next-playwright/123-456/dist",
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
      RAG_PROVIDER_MODE: "offline",
    });
    await expect(external()).rejects.toThrow(/invalid isolated Playwright offline environment/);
  });

  it("refuses to start a production server with local no-auth enabled", async () => {
    const register = await loadRegister({ ...PRODUCTION_NODE, LOCAL_NO_AUTH: "true" });
    await expect(register()).rejects.toThrow(/no-auth mode is enabled/);
  });

  it.each(["auto", "openai"] as const)(
    "refuses to start a %s production server without an OpenAI key",
    async (mode) => {
      const register = await loadRegister({
        ...PRODUCTION_NODE,
        NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        RAG_PROVIDER_MODE: mode,
      });
      await expect(register()).rejects.toThrow(/OPENAI_API_KEY/);
    },
  );

  it("starts an explicit offline production server without an OpenAI key", async () => {
    const register = await loadRegister({
      ...PRODUCTION_NODE,
      NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      RAG_PROVIDER_MODE: "offline",
      RAG_QUERY_HASH_SECRET: "test-secret-at-least-16-chars",
    });
    await expect(register()).resolves.toBeUndefined();
  });

  it("refuses to start a production server without a query-hash secret", async () => {
    const register = await loadRegister({
      ...PRODUCTION_NODE,
      NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      OPENAI_API_KEY: "openai-key",
    });
    await expect(register()).rejects.toThrow(/RAG_QUERY_HASH_SECRET/);
  });

  it("starts a fully configured production server", async () => {
    const register = await loadRegister(FULLY_CONFIGURED);
    await expect(register()).resolves.toBeUndefined();
  });

  it("warms the setup status once at boot through a non-loopback request", async () => {
    const register = await loadRegister(FULLY_CONFIGURED);
    await register();
    expect(warmSetupStatus).toHaveBeenCalledTimes(1);
    const [request] = warmSetupStatus.mock.calls[0]!;
    // A loopback host on an unmanaged port would be refused by the local-origin guard.
    expect(new URL(request.url).hostname).toBe("startup-warm.invalid");
  });

  it("is a no-op outside production, apart from the answer-feedback warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const register = await loadRegister({ NEXT_RUNTIME: "nodejs", NODE_ENV: "development" });
    await expect(register()).resolves.toBeUndefined();
    // No throw and no provider work — but boot does say once why answer feedback cannot
    // work without RAG_QUERY_HASH_SECRET, which is optional here (2026-09-02 audit, L44).
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Answer feedback is disabled");
    warn.mockRestore();
  });

  it("says nothing at boot outside production when the feedback secret is configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const register = await loadRegister({
      NEXT_RUNTIME: "nodejs",
      NODE_ENV: "development",
      RAG_QUERY_HASH_SECRET: "test-query-hash-secret-at-least-16-chars",
    });
    await expect(register()).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is a no-op on the Edge runtime", async () => {
    const register = await loadRegister({ NEXT_RUNTIME: "edge", NODE_ENV: "production" });
    await expect(register()).resolves.toBeUndefined();
  });
});

/**
 * The Caring Contacts live-mode boot gate had NO test at all before this file gained the block
 * below: the MAC verification, the missing-database refusal and the attestation parse could each
 * have been weakened without a single check going red. Found while verifying an external audit
 * on 2026-09-17. Every case here was watched failing against the unpatched gate before being
 * trusted.
 *
 * `CARING_CONTACTS_DEMO_ENABLED === "false"` is what arms the gate, and it is deliberately a
 * SUPERSET of live mode: a deployment that has turned the demo off but configured nothing else
 * must still be told what it is missing rather than quietly serving a shut workspace.
 */
const GOVERNANCE_SECRET = "governance-hmac-secret";

function validAttestation(): string {
  const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000).toISOString();
  return JSON.stringify({
    attestationVersion: "1.0.0",
    clinicalSafetyOfficer: {
      name: "Example Officer",
      ahpraRegistrationNumber: "MED0001234567",
      role: "Clinical Safety Officer",
    },
    hazardMitigations: {
      h00SafetyOfficerApproved: true,
      h04LivedExperienceReviewApproved: true,
      h05AboriginalCulturalSafetyApproved: true,
    },
    pilotScope: { validUntilIso: validUntil },
    digitalSignatureRef: "signature-reference-value",
  });
}

function macFor(raw: string): string {
  return createHmac("sha256", GOVERNANCE_SECRET).update(raw, "utf8").digest("hex");
}

/** Every live-mode requirement satisfied. Each case below removes exactly one of them. */
function liveModeEnv(attestation = validAttestation()) {
  return {
    ...FULLY_CONFIGURED,
    CARING_CONTACTS_DEMO_ENABLED: "false",
    CARING_CONTACTS_DATABASE_URL: "postgres://example.invalid/caring_contacts",
    CARING_CONTACTS_SESSION_HMAC_SECRET: "session-hmac-secret",
    CARING_CONTACTS_SESSION_ISSUER: "https://sso.example.invalid",
    CARING_CONTACTS_GOVERNANCE_ATTESTATION_JSON: attestation,
    CARING_CONTACTS_GOVERNANCE_ATTESTATION_MAC: macFor(attestation),
    CARING_CONTACTS_GOVERNANCE_HMAC_SECRET: GOVERNANCE_SECRET,
  } as const;
}

describe("Caring Contacts live-mode boot gate", () => {
  it("starts when every live-mode requirement is satisfied", async () => {
    const register = await loadRegister(liveModeEnv());
    await expect(register()).resolves.toBeUndefined();
  });

  it("leaves a demo-mode deployment alone", async () => {
    // The gate is armed by the exact string "false". Demo staging must pass straight through it,
    // attestation and all, or every sovereign demo deployment would refuse to boot.
    const register = await loadRegister({ ...FULLY_CONFIGURED, CARING_CONTACTS_DEMO_ENABLED: "true" });
    await expect(register()).resolves.toBeUndefined();
  });

  it("refuses live mode with no dedicated database, so real-patient writes cannot land in memory", async () => {
    const register = await loadRegister({ ...liveModeEnv(), CARING_CONTACTS_DATABASE_URL: undefined });
    await expect(register()).rejects.toThrow(/CARING_CONTACTS_DATABASE_URL/);
  });

  it("refuses live mode with no session secret rather than serving a silently shut workspace", async () => {
    const register = await loadRegister({ ...liveModeEnv(), CARING_CONTACTS_SESSION_HMAC_SECRET: undefined });
    await expect(register()).rejects.toThrow(/CARING_CONTACTS_SESSION_HMAC_SECRET/);
  });

  it("refuses live mode when no session issuer exists to mint the cookie it demands", async () => {
    // The defect this closes: nothing in this repository calls signProductionSession, so a live
    // deployment that is otherwise perfectly configured threw out of EVERY request. One refusal
    // at boot beats a 500 per request.
    const register = await loadRegister({ ...liveModeEnv(), CARING_CONTACTS_SESSION_ISSUER: undefined });
    await expect(register()).rejects.toThrow(/no session issuer/);
  });

  it.each([
    ["attestation", "CARING_CONTACTS_GOVERNANCE_ATTESTATION_JSON"],
    ["MAC", "CARING_CONTACTS_GOVERNANCE_ATTESTATION_MAC"],
    ["signing secret", "CARING_CONTACTS_GOVERNANCE_HMAC_SECRET"],
  ] as const)("refuses live mode with no governance %s", async (_label, key) => {
    const register = await loadRegister({ ...liveModeEnv(), [key]: undefined });
    await expect(register()).rejects.toThrow(/CARING_CONTACTS_GOVERNANCE_ATTESTATION_JSON/);
  });

  it("refuses an attestation whose MAC does not authenticate it", async () => {
    // The whole point of the MAC: an attestation that says every hazard is mitigated is worthless
    // if anyone who can set an environment variable can write one.
    const forged = validAttestation();
    const register = await loadRegister({
      ...liveModeEnv(forged),
      CARING_CONTACTS_GOVERNANCE_ATTESTATION_MAC: macFor(forged).replace(/.$/, (c) => (c === "0" ? "1" : "0")),
    });
    await expect(register()).rejects.toThrow(/MAC failed authentication/);
  });

  it("refuses a MAC of a different length instead of throwing out of timingSafeEqual", async () => {
    const register = await loadRegister({ ...liveModeEnv(), CARING_CONTACTS_GOVERNANCE_ATTESTATION_MAC: "short" });
    await expect(register()).rejects.toThrow(/MAC failed authentication/);
  });

  it("refuses an authenticated attestation that is not parseable JSON", async () => {
    const register = await loadRegister(liveModeEnv("{ not json"));
    await expect(register()).rejects.toThrow(/not parseable/);
  });

  it("refuses an authenticated attestation with an unmitigated hazard flag", async () => {
    // Authenticated but not approved: the MAC proves who wrote it, the validator decides whether
    // what it says is enough. H-05 is the Aboriginal cultural safety review.
    const payload = JSON.parse(validAttestation());
    payload.hazardMitigations.h05AboriginalCulturalSafetyApproved = false;
    const register = await loadRegister(liveModeEnv(JSON.stringify(payload)));
    await expect(register()).rejects.toThrow(/Unmitigated clinical hazard flags/);
  });

  it("refuses an authenticated attestation that has expired", async () => {
    const payload = JSON.parse(validAttestation());
    payload.pilotScope.validUntilIso = new Date(Date.now() - 1_000).toISOString();
    const register = await loadRegister(liveModeEnv(JSON.stringify(payload)));
    await expect(register()).rejects.toThrow(/expired or has an invalid date/);
  });
});
