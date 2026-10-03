import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  createServer: vi.fn(),
  probe: vi.fn(),
  execFile: vi.fn(),
}));
vi.mock("node:http", () => ({ createServer: mocks.createServer }));
vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));
vi.mock("../src/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("../src/lib/supabase/health", () => ({ probeSupabaseHealth: mocks.probe }));

import { createHealthCheckServer, startWorkerHealthServerIfConfigured } from "../worker/health";

describe("worker health port", () => {
  beforeEach(() => {
    mocks.createServer.mockReturnValue({ listen: mocks.listen });
    vi.stubEnv("WORKER_HEALTH_PORT", undefined);
    vi.stubEnv("PORT", undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([
    [undefined, "8080", 8080],
    ["", "4567", 4567],
    ["3001", "8080", 3001],
    ["3001", undefined, 3001],
  ])("binds override %s and Railway PORT %s to %s", (override, railwayPort, expected) => {
    vi.stubEnv("WORKER_HEALTH_PORT", override);
    vi.stubEnv("PORT", railwayPort);
    expect(startWorkerHealthServerIfConfigured()).not.toBeNull();
    expect(mocks.listen).toHaveBeenCalledWith(expected, "0.0.0.0", expect.any(Function));
  });

  it.each([undefined, "invalid", "0", "-1"])("keeps invalid or unconfigured port %s disabled", (port) => {
    vi.stubEnv("PORT", port);
    expect(startWorkerHealthServerIfConfigured()).toBeNull();
    expect(mocks.createServer).not.toHaveBeenCalled();
  });

  it("retains 503 for a failed database readiness probe", async () => {
    mocks.probe.mockRejectedValue(new Error("offline fixture failure"));
    mocks.execFile.mockImplementation((_bin, _args, _options, callback) => callback(null));
    createHealthCheckServer();
    const handler = mocks.createServer.mock.calls[0][0];
    const response = { writeHead: vi.fn(), end: vi.fn() };
    await handler({ method: "GET", url: "/health" }, response);
    expect(mocks.probe).toHaveBeenCalledOnce();
    expect(response.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    expect(JSON.parse(response.end.mock.calls[0][0])).toMatchObject({ status: "error" });
  });
});
