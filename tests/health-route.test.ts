import { afterEach, describe, expect, it, vi } from "vitest";

function mockEnv(options: { configured: boolean; demoMode?: boolean }) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: options.configured ? "https://sjrfecxgysukkwxsowpy.supabase.co" : undefined,
      SUPABASE_SERVICE_ROLE_KEY: options.configured ? "service-role-key" : undefined,
      OPENAI_API_KEY: options.configured ? "openai-key" : undefined,
    },
    isDemoMode: () => Boolean(options.demoMode),
  }));
}

function healthRequest(query = "") {
  return new Request(`http://localhost/api/health${query}`);
}

async function payload(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("reports ok when fully configured", async () => {
    mockEnv({ configured: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toMatchObject({ supabaseConfig: "ok", openaiConfig: "ok" });
    expect(body.demoMode).toBe(false);
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("reports degraded with 503 when required config is missing", async () => {
    mockEnv({ configured: false });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const body = await payload(response);

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks).toMatchObject({ supabaseConfig: "missing", openaiConfig: "missing" });
  });

  it("does not leak secret values in the payload", async () => {
    mockEnv({ configured: true });
    const { GET } = await import("../src/app/api/health/route");

    const response = await GET(healthRequest());
    const raw = JSON.stringify(await payload(response));

    expect(raw).not.toContain("service-role-key");
    expect(raw).not.toContain("openai-key");
  });
});

describe("GET /api/health/ready", () => {
  it("runs the Supabase readiness branch without requiring the diagnostic probe token", async () => {
    mockEnv({ configured: true, demoMode: true });
    const { GET } = await import("../src/app/api/health/ready/route");

    const response = await GET(new Request("http://localhost/api/health/ready"));
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.checks).toMatchObject({ supabaseConfig: "ok", openaiConfig: "ok", supabase: "skipped" });
  });
});
