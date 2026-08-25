import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES } from "@/lib/account-preferences";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

const previousClientPayload = {
  density: "compact",
  motion: "reduced",
  jurisdiction: "nsw",
  population: "adults",
  answerStyle: "balanced",
  landing: "ask",
  showRecentOnHome: true,
  showProtocolsOnHome: true,
  compactCitations: false,
  // Intentionally omit saveRecentSearches — tabs opened before that field
  // shipped still PUT this shape.
  notifyGuidelineUpdates: true,
  notifyProductNews: false,
  notifySavedChanges: true,
} as const;

function mockPreferencesRoute(existingPreferences: Record<string, unknown> | null) {
  const upsert = vi.fn(async () => ({ error: null }));
  const maybeSingle = vi.fn(async () => ({
    data: existingPreferences ? { preferences: existingPreferences } : null,
    error: null,
  }));
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  const from = vi.fn(() => ({ upsert, select }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({ from }),
  }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: class AuthenticationError extends Error {},
    requireAuthenticatedUser: vi.fn(async () => ({ id: "user-preferences-1" })),
    unauthorizedResponse: () => new Response("unauthorized", { status: 401 }),
  }));
  return { upsert, maybeSingle };
}

describe("PUT /api/account/preferences", () => {
  it("accepts the previous client payload without saveRecentSearches and defaults it on for a new account", async () => {
    const { upsert } = mockPreferencesRoute(null);

    const { PUT } = await import("@/app/api/account/preferences/route");
    const response = await PUT(
      new Request("http://local.test/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previousClientPayload),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preferences.saveRecentSearches).toBe(DEFAULT_PREFERENCES.saveRecentSearches);
    expect(body.preferences.density).toBe("compact");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-preferences-1",
        preferences: expect.objectContaining({
          ...previousClientPayload,
          saveRecentSearches: true,
        }),
      }),
    );
  });

  it("preserves an existing saveRecentSearches opt-out when the client omits the field", async () => {
    const { upsert } = mockPreferencesRoute({
      ...DEFAULT_PREFERENCES,
      saveRecentSearches: false,
    });

    const { PUT } = await import("@/app/api/account/preferences/route");
    const response = await PUT(
      new Request("http://local.test/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previousClientPayload),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preferences.saveRecentSearches).toBe(false);
    expect(body.preferences.density).toBe("compact");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          saveRecentSearches: false,
          density: "compact",
        }),
      }),
    );
  });
});
