import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseFavouritesSnapshot } from "@/lib/favourites-client-contract";
import { requireCanonicalFavouriteReference } from "@/lib/favourites-reference";
import {
  favouriteSetResponseSchema,
  favouriteUpdateResponseSchema,
  favouritesSnapshotSchema,
} from "@/lib/favourites-contract";

describe("favourites contract", () => {
  it("rejects a canonical-looking but unknown service key", async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    const supabase = { from: () => query };

    await expect(
      requireCanonicalFavouriteReference(supabase as never, "owner-1", "service", "patient-12345"),
    ).rejects.toMatchObject({ status: 422, details: { code: "favourite_content_not_found" } });
  });

  it("fails closed on malformed successful response payloads", () => {
    expect(favouritesSnapshotSchema.safeParse({ version: 1, favourites: [], sets: [], extra: true }).success).toBe(
      false,
    );
    expect(favouriteSetResponseSchema.safeParse({ version: 1, set: { id: "not-a-uuid" } }).success).toBe(false);
    expect(favouriteUpdateResponseSchema.safeParse({ version: 1, updated: false }).success).toBe(false);
  });

  it("accepts PostgREST timestamptz precision on the client, not just the 3-digit JS shape (M10)", () => {
    // The API route passes `created_at` / `pinned_at` / `last_opened_at` /
    // `updated_at` straight from Supabase. Postgres `now()` is microsecond
    // precision and trims trailing zeros, so 6-, 4- and 1-digit fractions with a
    // `+00:00` offset are the norm in live mode; the server's Zod check accepts
    // them all, and one rejected row nulls the whole client snapshot.
    const snapshot = {
      version: 1,
      favourites: [
        {
          contentType: "service",
          contentKey: "service:example",
          createdAt: "2026-06-27T14:10:20.550361+00:00",
          setId: "6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f",
          sortOrder: 0,
          pinnedAt: "2026-06-27T14:10:20.5+00:00",
          lastOpenedAt: "2026-06-27T14:10:20.1235+00:00",
        },
        {
          contentType: "form",
          contentKey: "form:example",
          createdAt: "2026-06-27T14:10:20+00:00",
          setId: null,
          sortOrder: 1,
          pinnedAt: null,
          lastOpenedAt: "2026-08-23T00:00:00.000Z",
        },
      ],
      sets: [
        {
          id: "6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f",
          name: "Ward round",
          sortOrder: 0,
          createdAt: "2026-06-27T14:10:20.550361+00:00",
          updatedAt: "2026-06-27T14:10:21.55+00:00",
        },
      ],
    };

    expect(parseFavouritesSnapshot(snapshot)).toEqual(snapshot);

    // Still fails closed on anything that is not an ISO instant.
    for (const createdAt of ["2026-06-27", "2026-06-27T14:10:20", "2026-06-27 14:10:20+00:00", "not a date"]) {
      expect(
        parseFavouritesSnapshot({
          ...snapshot,
          favourites: [{ ...snapshot.favourites[1], createdAt }],
        }),
      ).toBeNull();
    }
  });

  it("keeps legacy key validation deferred and makes item reordering server authoritative", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20260823090000_user_favourite_sets.sql", import.meta.url),
      "utf8",
    ).toLowerCase();
    expect(migration).toContain("user_favourites_content_key_format_check\n  check");
    expect(migration).toContain("not valid");
    expect(migration).not.toContain("validate constraint user_favourites_content_key_format_check");
    expect(migration).toContain("partition by user_id\n");
    expect(migration).toContain("reorder_user_favourite");
    expect(migration).toContain("target_set_id uuid");
    expect(migration).toContain("set_id is not distinct from target_set_id");
  });
});
