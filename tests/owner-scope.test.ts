import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("RetrievalAccessScope", () => {
  it("resolves anonymous access to public-only and authenticated access to owner-plus-public", async () => {
    const { resolveRetrievalAccessScope } = await import("../src/lib/owner-scope");
    expect(resolveRetrievalAccessScope()).toEqual({ includePublic: true });
    expect(resolveRetrievalAccessScope("owner-a")).toEqual({ ownerId: "owner-a", includePublic: true });
  });

  it("matches public-only or exact-owner plus public without crossing tenants", async () => {
    const { retrievalAccessScopeMatchesOwner } = await import("../src/lib/owner-scope");
    expect(retrievalAccessScopeMatchesOwner({ includePublic: true }, null)).toBe(true);
    expect(retrievalAccessScopeMatchesOwner({ includePublic: true }, "owner-a")).toBe(false);
    expect(retrievalAccessScopeMatchesOwner({ ownerId: "owner-a", includePublic: true }, null)).toBe(true);
    expect(retrievalAccessScopeMatchesOwner({ ownerId: "owner-a", includePublic: true }, "owner-a")).toBe(true);
    expect(retrievalAccessScopeMatchesOwner({ ownerId: "owner-a", includePublic: true }, "owner-b")).toBe(false);
  });

  it("builds collision-free public and owner-plus-public scope keys", async () => {
    const { retrievalAccessScopeKey } = await import("../src/lib/owner-scope");
    expect(retrievalAccessScopeKey({ includePublic: true })).toBe("public-only");
    expect(retrievalAccessScopeKey({ ownerId: "owner-a", includePublic: true })).toBe("owner:owner-a+public");
    expect(retrievalAccessScopeKey({ ownerId: "owner-a", includePublic: true })).not.toBe(
      retrievalAccessScopeKey({ ownerId: "owner-b", includePublic: true }),
    );
  });
});

describe("requireOwnerScope (fail-closed owner scoping)", () => {
  it("returns the ownerId when present", async () => {
    const { requireOwnerScope } = await import("../src/lib/owner-scope");
    expect(requireOwnerScope("owner-1")).toBe("owner-1");
  });

  it("returns the public sentinel (never null) without an owner in demo mode", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true, isLocalNoAuthMode: () => false }));
    const { requireOwnerScope, PUBLIC_OWNER_FILTER_SENTINEL } = await import("../src/lib/owner-scope");
    // Must not return undefined/null: that reaches the retrieval RPCs as a NULL
    // owner_filter, which now fails closed (migration 20260708160001). The public
    // sentinel scopes these modes to the shared public corpus instead.
    expect(requireOwnerScope(undefined)).toBe(PUBLIC_OWNER_FILTER_SENTINEL);
    expect(requireOwnerScope(null)).toBe(PUBLIC_OWNER_FILTER_SENTINEL);
  });

  it("throws when a real (non-demo, non-local) deployment omits the ownerId", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false, isLocalNoAuthMode: () => false }));
    vi.stubEnv("NODE_ENV", "production");
    const { requireOwnerScope } = await import("../src/lib/owner-scope");
    expect(() => requireOwnerScope(undefined)).toThrow(/without an ownerId/);
    expect(() => requireOwnerScope(null)).toThrow(/tenant/);
  });
});

describe("retrievalOwnerFilter", () => {
  it("returns the public sentinel for anonymous production global search", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => false, isLocalNoAuthMode: () => false }));
    vi.stubEnv("NODE_ENV", "production");
    const { retrievalOwnerFilter, PUBLIC_OWNER_FILTER_SENTINEL } = await import("../src/lib/owner-scope");
    expect(retrievalOwnerFilter({ allowGlobalSearch: true })).toBe(PUBLIC_OWNER_FILTER_SENTINEL);
  });

  it("returns the public sentinel (never null) in demo/test mode without an owner", async () => {
    vi.doMock("@/lib/env", () => ({ isDemoMode: () => true, isLocalNoAuthMode: () => false }));
    const { retrievalOwnerFilter, PUBLIC_OWNER_FILTER_SENTINEL } = await import("../src/lib/owner-scope");
    expect(retrievalOwnerFilter({})).toBe(PUBLIC_OWNER_FILTER_SENTINEL);
  });
});
