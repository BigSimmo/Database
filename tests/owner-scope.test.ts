import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("requireOwnerScope (fail-closed owner scoping)", () => {
  it("returns the ownerId when present", async () => {
    const { requireOwnerScope } = await import("../src/lib/owner-scope");
    expect(requireOwnerScope("owner-1")).toBe("owner-1");
  });

  it("stays permissive (undefined) without an owner in demo mode", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true, isLocalNoAuthMode: () => false }));
    const { requireOwnerScope } = await import("../src/lib/owner-scope");
    expect(requireOwnerScope(undefined)).toBeUndefined();
    expect(requireOwnerScope(null)).toBeUndefined();
  });

  it("throws when a real (non-demo, non-local) deployment omits the ownerId", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false, isLocalNoAuthMode: () => false }));
    vi.stubEnv("NODE_ENV", "production");
    const { requireOwnerScope } = await import("../src/lib/owner-scope");
    expect(() => requireOwnerScope(undefined)).toThrow(/without an ownerId/);
    expect(() => requireOwnerScope(null)).toThrow(/tenant/);
  });
});
