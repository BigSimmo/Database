import { afterEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  flush: vi.fn(async () => true),
  setFingerprint: vi.fn(),
  setTag: vi.fn(),
  withScope: vi.fn(
    (callback: (scope: { setFingerprint: typeof sentry.setFingerprint; setTag: typeof sentry.setTag }) => void) =>
      callback({ setFingerprint: sentry.setFingerprint, setTag: sentry.setTag }),
  ),
}));

vi.mock("@sentry/nextjs", () => sentry);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Next request error capture", () => {
  it("uses the SDK request-error path and attaches the static route pattern", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
    const { captureRequestError } = await import("@/lib/observability/error-tracking");
    const error = new TypeError("synthetic failure");
    const request = { path: "/api/example?private=1", method: "GET", headers: { authorization: "redacted" } };
    const context = {
      routerKind: "App Router",
      routePath: "/api/example",
      routeType: "route",
      renderSource: "server-rendering",
      revalidateReason: undefined,
      renderType: "dynamic",
    } as const;

    await captureRequestError(error, request, context);

    expect(sentry.setTag).toHaveBeenCalledWith("route_path", "/api/example");
    expect(sentry.setTag).toHaveBeenCalledWith("router_kind", "App Router");
    expect(sentry.captureRequestError).toHaveBeenCalledWith(error, request, context);
    expect(sentry.flush).toHaveBeenCalledWith(2_000);
  });
});
