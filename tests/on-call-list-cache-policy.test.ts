import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/on-call/entries` answered with no `Cache-Control` at all until 2026-09-16, which
 * leaves a shared cache free to store an owner-scoped clinical response heuristically and serve
 * it to the next caller. The response is owner-shaped — a signed-in caller's copy carries their
 * `is_personal` entries, the one thing this mode never publishes — so it must declare the
 * repository's private policy on every variant, including the anonymous and demo ones that
 * happen to contain only shared rows.
 */

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const state = vi.hoisted(() => ({ demoMode: false }));

function rateLimitRow() {
  return {
    limited: false,
    limit_value: 100,
    remaining: 99,
    retry_after_seconds: 60,
    reset_at: new Date(Date.now() + 60_000).toISOString(),
  };
}

vi.mock("@/lib/env", () => ({
  env: {},
  isDemoMode: () => state.demoMode,
  isLocalNoAuthMode: () => false,
  requireServerEnv: () => undefined,
  requireOpenAIEnv: () => undefined,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: [rateLimitRow()], error: null }),
  }),
}));

vi.mock("@/lib/supabase/auth", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireAuthenticatedUser: vi.fn(),
  getOptionalAuthenticatedUser: vi.fn(async (request: Request) =>
    /^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "") ? { id: ownerId } : null,
  ),
  unauthorizedResponse: () => new Response(null, { status: 401 }),
}));

vi.mock("@/lib/on-call/repository", () => ({
  fetchVisibleOnCallEntries: vi.fn(async () => []),
  assertValidLinkedDocumentIds: vi.fn(),
  onCallEntryToRow: vi.fn(),
  rowToOnCallEntry: vi.fn(),
}));

function listRequest(init?: RequestInit) {
  return new Request("http://localhost/api/on-call/entries", init);
}

afterEach(() => {
  state.demoMode = false;
});

describe("On Call entries list cache policy", () => {
  it("marks a signed-in caller's list private and uncacheable", async () => {
    const { GET } = await import("@/app/api/on-call/entries/route");

    const response = await GET(listRequest({ headers: { authorization: "Bearer valid-token" } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not let the anonymous variant become publicly cacheable at the same URL", async () => {
    const { GET } = await import("@/app/api/on-call/entries/route");

    const response = await GET(listRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    // Whatever a cache does with the response, it may not treat one caller's copy as another's.
    expect(response.headers.get("Vary")).toBe("Cookie, Authorization");
  });

  it("declares the same policy on the demo-mode list", async () => {
    state.demoMode = true;
    const { GET } = await import("@/app/api/on-call/entries/route");

    const response = await GET(listRequest());
    const body = (await response.json()) as { demoMode?: boolean };

    expect(body.demoMode).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
