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

const INITIAL_UPDATED_AT = "2026-08-25T00:00:00.000Z";

function mockPreferencesRoute(
  existingPreferences: Record<string, unknown> | null,
  { synchronizeFirstReads = false }: { synchronizeFirstReads?: boolean } = {},
) {
  let row = existingPreferences
    ? { preferences: structuredClone(existingPreferences), updated_at: INITIAL_UPDATED_AT }
    : null;
  let firstReadCount = 0;
  let releaseFirstReads = () => {};
  const firstReadsReady = new Promise<void>((resolve) => {
    releaseFirstReads = resolve;
  });

  const maybeSingle = vi.fn(async () => {
    const snapshot = row ? structuredClone(row) : null;
    if (synchronizeFirstReads && firstReadCount < 2) {
      firstReadCount += 1;
      if (firstReadCount === 2) releaseFirstReads();
      await firstReadsReady;
    }
    return { data: snapshot, error: null };
  });
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));

  const insert = vi.fn(async (value: { preferences: Record<string, unknown>; updated_at: string }) => {
    if (row) return { error: { code: "23505", message: "duplicate key" } };
    row = { preferences: structuredClone(value.preferences), updated_at: value.updated_at };
    return { error: null };
  });

  const update = vi.fn((value: { preferences: Record<string, unknown>; updated_at: string }) => {
    const filters = new Map<string, unknown>();
    const builder = {
      eq(field: string, expected: unknown) {
        filters.set(field, expected);
        return builder;
      },
      select() {
        return {
          maybeSingle: async () => {
            if (!row || filters.get("updated_at") !== row.updated_at) return { data: null, error: null };
            row = { preferences: structuredClone(value.preferences), updated_at: value.updated_at };
            return { data: { updated_at: row.updated_at }, error: null };
          },
        };
      },
    };
    return builder;
  });

  const from = vi.fn(() => ({ insert, select, update }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({ from }),
  }));
  vi.doMock("@/lib/supabase/auth", () => ({
    AuthenticationError: class AuthenticationError extends Error {},
    requireAuthenticatedUser: vi.fn(async () => ({ id: "user-preferences-1" })),
    unauthorizedResponse: () => new Response("unauthorized", { status: 401 }),
  }));
  return {
    currentPreferences: () => row?.preferences,
    insert,
    maybeSingle,
    update,
  };
}

describe("PUT /api/account/preferences", () => {
  it("accepts the previous client payload without saveRecentSearches and defaults it on for a new account", async () => {
    const { insert } = mockPreferencesRoute(null);

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
    expect(insert).toHaveBeenCalledWith(
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
    const { update } = mockPreferencesRoute({
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
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          saveRecentSearches: false,
          density: "compact",
        }),
      }),
    );
    expect(Date.parse(update.mock.calls[0][0].updated_at)).toBeGreaterThan(Date.parse(INITIAL_UPDATED_AT));
  });

  it("retries a lost compare-and-swap so concurrent independent patches are both preserved", async () => {
    const database = mockPreferencesRoute(DEFAULT_PREFERENCES, { synchronizeFirstReads: true });

    const { PUT } = await import("@/app/api/account/preferences/route");
    const [densityResponse, motionResponse] = await Promise.all([
      PUT(
        new Request("http://local.test/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ density: "compact" }),
        }),
      ),
      PUT(
        new Request("http://local.test/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motion: "reduced" }),
        }),
      ),
    ]);

    expect([densityResponse.status, motionResponse.status]).toEqual([200, 200]);
    expect(database.currentPreferences()).toMatchObject({ density: "compact", motion: "reduced" });
    expect(database.update).toHaveBeenCalledTimes(3);
  });

  it("retries a duplicate insert when concurrent requests create the first preference row", async () => {
    const database = mockPreferencesRoute(null, { synchronizeFirstReads: true });

    const { PUT } = await import("@/app/api/account/preferences/route");
    const [densityResponse, motionResponse] = await Promise.all([
      PUT(
        new Request("http://local.test/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ density: "compact" }),
        }),
      ),
      PUT(
        new Request("http://local.test/api/account/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motion: "reduced" }),
        }),
      ),
    ]);

    expect([densityResponse.status, motionResponse.status]).toEqual([200, 200]);
    expect(database.currentPreferences()).toMatchObject({ density: "compact", motion: "reduced" });
    expect(database.insert).toHaveBeenCalledTimes(2);
    expect(database.update).toHaveBeenCalledTimes(1);
  });
});
