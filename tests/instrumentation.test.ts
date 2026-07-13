import { afterEach, describe, expect, it, vi } from "vitest";

// The boot guard (src/instrumentation.ts) must refuse to start a production server
// that is misconfigured (missing/mismatched Supabase or OpenAI config), running in
// demo mode, or running with local no-auth enabled. It must be a no-op outside the
// Node.js production runtime so dev and Edge keep working. env is parsed at import
// time, so each case re-imports the module with a fresh, stubbed environment.

const MATCHING_URL = "https://sjrfecxgysukkwxsowpy.supabase.co";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@sentry/node", () => sentryMocks);

const ENV_KEYS = [
  "NEXT_RUNTIME",
  "NODE_ENV",
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "OPENAI_API_KEY",
  "RAG_QUERY_HASH_SECRET",
  "NEXT_PUBLIC_LOCAL_NO_AUTH",
  "LOCAL_NO_AUTH",
  "SENTRY_DSN",
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

const TEST_DSN = "https://publickey@o0.ingest.sentry.io/0";

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

  it("refuses to start a production server with local no-auth enabled", async () => {
    const register = await loadRegister({ ...PRODUCTION_NODE, LOCAL_NO_AUTH: "true" });
    await expect(register()).rejects.toThrow(/no-auth mode is enabled/);
  });

  it("refuses to start a production server without an OpenAI key", async () => {
    const register = await loadRegister({
      ...PRODUCTION_NODE,
      NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    await expect(register()).rejects.toThrow(/OPENAI_API_KEY/);
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
    const register = await loadRegister({
      ...PRODUCTION_NODE,
      NEXT_PUBLIC_SUPABASE_URL: MATCHING_URL,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      OPENAI_API_KEY: "openai-key",
      RAG_QUERY_HASH_SECRET: "test-secret-at-least-16-chars",
    });
    await expect(register()).resolves.toBeUndefined();
  });

  it("is a no-op outside production", async () => {
    const register = await loadRegister({ NEXT_RUNTIME: "nodejs", NODE_ENV: "development" });
    await expect(register()).resolves.toBeUndefined();
  });

  it("is a no-op on the Edge runtime", async () => {
    const register = await loadRegister({ NEXT_RUNTIME: "edge", NODE_ENV: "production" });
    await expect(register()).resolves.toBeUndefined();
  });
});

describe("instrumentation Sentry init", () => {
  it("does not initialize Sentry without a DSN", async () => {
    const register = await loadRegister(FULLY_CONFIGURED);
    await expect(register()).resolves.toBeUndefined();
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry with privacy scrubbing when a DSN is configured", async () => {
    const register = await loadRegister({ ...FULLY_CONFIGURED, SENTRY_DSN: TEST_DSN });
    await expect(register()).resolves.toBeUndefined();

    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    const options = sentryMocks.init.mock.calls[0][0];
    expect(options.dsn).toBe(TEST_DSN);
    expect(options.sendDefaultPii).toBe(false);

    // The scrubbers must strip request payloads/headers and breadcrumbs so
    // clinical query text can never ride along on an event.
    const event = {
      request: { url: "https://x/api/answer", headers: { cookie: "secret" }, data: "clinical query" },
      breadcrumbs: [{ message: "console line" }],
      exception: {},
    };
    const scrubbed = options.beforeSend(event);
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(options.beforeBreadcrumb()).toBeNull();
  });
});

describe("instrumentation onRequestError", () => {
  const REQUEST = { path: "/api/documents?q=lithium", method: "GET", headers: {} };
  const CONTEXT = {
    routerKind: "App Router",
    routePath: "/api/documents",
    routeType: "route",
    revalidateReason: undefined,
  } as const;

  it("is a no-op without a DSN", async () => {
    const mod = await loadInstrumentation({ ...PRODUCTION_NODE });
    await expect(mod.onRequestError(new Error("boom"), REQUEST, CONTEXT)).resolves.toBeUndefined();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("is a no-op outside the Node.js runtime", async () => {
    const mod = await loadInstrumentation({ NEXT_RUNTIME: "edge", NODE_ENV: "production", SENTRY_DSN: TEST_DSN });
    await expect(mod.onRequestError(new Error("boom"), REQUEST, CONTEXT)).resolves.toBeUndefined();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("captures uncaught request errors with query strings stripped", async () => {
    const mod = await loadInstrumentation({ ...PRODUCTION_NODE, SENTRY_DSN: TEST_DSN });
    const error = new Error("boom");
    await mod.onRequestError(error, REQUEST, CONTEXT);

    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    const [captured, hint] = sentryMocks.captureException.mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured).not.toBe(error);
    expect(captured.message).toBe("Server request failed");
    expect(captured.stack).not.toContain("boom");
    expect(hint.extra.path).toBe("/api/documents");
    expect(hint.extra.routeType).toBe("route");
    expect(JSON.stringify(hint)).not.toContain("lithium");
  });
});
