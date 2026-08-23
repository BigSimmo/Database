import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
