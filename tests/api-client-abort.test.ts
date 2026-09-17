import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A reader who navigates away mid-typeahead cancels an in-flight request. That is not a server
 * fault, and three registry routes were reporting it as one: their catch blocks fell through to
 * `jsonError(error)`, which answers HTTP 500 and writes an `error`-level "API request failed" log.
 * `/api/search`, `/api/upload` and `/api/speech/transcribe` already answered 499 here; these three
 * now match them.
 *
 * Scope note, recorded so nobody reads more into this than it proves: this removes false 500s and
 * spurious error logs. It is NOT established to close any Sentry issue — measured 2026-09-17, 849
 * of 853 error events carried no `route_path`, meaning they did not reach Sentry through a route
 * handler's return path at all.
 */
const abortError = () => new DOMException("The operation was aborted.", "AbortError");

const loggerError = vi.fn();

function mockRuntime() {
  vi.resetModules();
  loggerError.mockClear();
  vi.doMock("@/lib/env", () => ({
    env: {},
    isDemoMode: () => false,
    isLocalNoAuthMode: () => false,
  }));
  vi.doMock("@/lib/logger", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
      rpc: vi.fn(async () => ({
        data: [{ limited: false, limit_value: 120, remaining: 119, retry_after_seconds: 60 }],
        error: null,
      })),
    }),
  }));
}

/** Make the canonical catalogue read reject exactly as a caller abort makes it reject. */
function mockCatalogueAbort() {
  vi.doMock("@/lib/site-content/catalogue-seed-fallback", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    readCatalogueWithSeedFallback: vi.fn(async () => {
      throw abortError();
    }),
  }));
}

function mockUniversalSearchAbort() {
  vi.doMock("@/lib/universal-search", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    runUniversalSearch: vi.fn(async () => {
      throw abortError();
    }),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

const cases = [
  {
    name: "/api/differentials",
    path: "/api/differentials?kind=diagnosis",
    modulePath: "../src/app/api/differentials/route",
    mockAbort: mockCatalogueAbort,
  },
  {
    name: "/api/medications",
    path: "/api/medications",
    modulePath: "../src/app/api/medications/route",
    mockAbort: mockCatalogueAbort,
  },
  {
    name: "/api/search/universal",
    path: "/api/search/universal?q=lithium",
    modulePath: "../src/app/api/search/universal/route",
    mockAbort: mockUniversalSearchAbort,
  },
] as const;

describe("a cancelled request is answered 499, not reported as a server fault", () => {
  for (const item of cases) {
    it(`${item.name} answers 499 with an empty body when the read aborts`, async () => {
      mockRuntime();
      item.mockAbort();
      const { GET } = await import(item.modulePath);

      const response = await GET(new Request(`http://localhost${item.path}`));

      expect(response.status).toBe(499);
      expect(await response.text()).toBe("");
    });

    it(`${item.name} does not log a cancelled request at error level`, async () => {
      mockRuntime();
      item.mockAbort();
      const { GET } = await import(item.modulePath);

      await GET(new Request(`http://localhost${item.path}`));

      expect(loggerError).not.toHaveBeenCalledWith("API request failed", expect.anything());
    });

    it(`${item.name} still answers 499 when the signal aborted and the error is not an AbortError`, async () => {
      mockRuntime();
      vi.doMock("@/lib/site-content/catalogue-seed-fallback", async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        readCatalogueWithSeedFallback: vi.fn(async () => {
          throw new Error("socket hang up");
        }),
      }));
      vi.doMock("@/lib/universal-search", async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        runUniversalSearch: vi.fn(async () => {
          throw new Error("socket hang up");
        }),
      }));
      const { GET } = await import(item.modulePath);

      const controller = new AbortController();
      controller.abort();
      const response = await GET(new Request(`http://localhost${item.path}`, { signal: controller.signal }));

      expect(response.status).toBe(499);
    });
  }

  it("a genuine failure on a live connection is still reported as a server error", async () => {
    mockRuntime();
    vi.doMock("@/lib/site-content/catalogue-seed-fallback", async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      readCatalogueWithSeedFallback: vi.fn(async () => {
        throw new Error("relation does not exist");
      }),
    }));
    const { GET } = await import("../src/app/api/differentials/route");

    const response = await GET(new Request("http://localhost/api/differentials?kind=diagnosis"));

    expect(response.status).toBe(500);
    expect(loggerError).toHaveBeenCalled();
  });
});
