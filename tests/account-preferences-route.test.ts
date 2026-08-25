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

describe("PUT /api/account/preferences", () => {
  it("accepts the previous client payload without saveRecentSearches and defaults it on", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ upsert }));
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({ from }),
    }));
    vi.doMock("@/lib/supabase/auth", () => ({
      AuthenticationError: class AuthenticationError extends Error {},
      requireAuthenticatedUser: vi.fn(async () => ({ id: "user-preferences-1" })),
      unauthorizedResponse: () => new Response("unauthorized", { status: 401 }),
    }));

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
});
