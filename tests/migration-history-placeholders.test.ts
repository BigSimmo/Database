import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * When migrations are renamed/renumbered, hosted Supabase Preview fails if the
 * remote history table still records the old version. Keep a local file for
 * every historically deleted version number that is no longer represented by a
 * current migration filename prefix.
 */
const KNOWN_ORPHAN_VERSIONS = [
  "20260713110000",
  "20260713120000",
  "20260713121000",
  "20260713122000",
  "20260717133000",
  "20260718223000",
] as const;

describe("migration history placeholders", () => {
  it("keeps a local sql file for every known orphan remote version", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const versions = new Set(
      readdirSync(migrationsDir)
        .map((name) => /^(\d{14})_.*\.sql$/.exec(name)?.[1] ?? null)
        .filter((version): version is string => Boolean(version)),
    );

    const missing = KNOWN_ORPHAN_VERSIONS.filter((version) => !versions.has(version));
    expect(missing).toEqual([]);
  });
});
