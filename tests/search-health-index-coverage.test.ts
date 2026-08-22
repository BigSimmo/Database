import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Runtime index-monitoring ratchet (docs/database-drift-detection.md, plan
 * phase 6.3). `search_schema_health()` monitors a curated `required_indexes`
 * list; the 20 repo-defined indexes found absent on live in 2026-08 were
 * invisible to it. This test makes every monitoring decision on the
 * retrieval-critical tables explicit: each repo-defined index there is either
 * monitored (required_indexes / index_aliases) or listed with a reason and a
 * disposition in supabase/search-health-unmonitored-indexes.json.
 *
 * "Repo-defined" is computed two ways and unioned, so neither source can hide
 * an index from the other: (a) an order-aware replay of every create/drop
 * index statement in supabase/migrations, (b) supabase/drift-manifest.json
 * (schema.sql replayed from scratch). Constraint-backed primary-key indexes
 * are exempt: the constraint inventory in check:drift already guards them.
 */

const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

export const RETRIEVAL_CRITICAL_TABLES = [
  "documents",
  "document_chunks",
  "document_index_units",
  "document_embedding_fields",
  "document_memory_cards",
  "rag_retrieval_logs",
] as const;

type Disposition = "accepted-unmonitored" | "monitor-candidate";
type UnmonitoredEntry = { index: string; table: string; reason: string; disposition: Disposition };
type CoverageFile = { _comment?: string; unmonitored: UnmonitoredEntry[] };

const stripSql = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

/** Order-aware replay of create/drop index across the migration chain. */
function migrationIndexes(): Map<string, string> {
  const live = new Map<string, string>(); // index -> table
  const files = readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
  const statement =
    /\b(create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z0-9_]+)\s+on\s+(?:only\s+)?(?:public\.)?([a-z0-9_]+)|drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?([^;]+?))\s*(?=[;(]|\busing\b|\bcascade\b|\brestrict\b)/gi;
  for (const file of files) {
    const sql = stripSql(readFileSync(join(migrationsDir, file), "utf8"));
    for (const match of sql.matchAll(statement)) {
      if (match[2]) {
        live.set(match[2].toLowerCase(), match[3].toLowerCase());
      } else if (match[4]) {
        for (const raw of match[4].split(",")) {
          const name = raw
            .trim()
            .replace(/^public\./i, "")
            .toLowerCase();
          if (name) live.delete(name);
        }
      }
    }
  }
  return live;
}

function manifestIndexes(): { indexes: Map<string, string>; primaryKeys: Set<string> } {
  const { snapshot } = JSON.parse(read("supabase/drift-manifest.json")) as {
    snapshot: {
      indexes: { name: string; table: string; def: string }[];
      constraints: { name: string; table: string; def: string }[];
    };
  };
  const indexes = new Map<string, string>();
  for (const row of snapshot.indexes) indexes.set(row.name, row.table);
  const primaryKeys = new Set<string>();
  for (const con of snapshot.constraints) {
    if (/^PRIMARY KEY/i.test(con.def)) primaryKeys.add(con.name);
  }
  return { indexes, primaryKeys };
}

/** required_indexes + every index_aliases value from the LATEST search_schema_health definer. */
function monitoredIndexes(): { monitored: Set<string>; definer: string } {
  const files = readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
  const definerPattern =
    /create\s+or\s+replace\s+function\s+public\.search_schema_health\s*\(\)[\s\S]*?\$\$[\s\S]*?\$\$/i;
  let definer = "";
  let body = "";
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const match = sql.match(definerPattern);
    if (match) {
      definer = file;
      body = match[0];
    }
  }
  expect(definer, "no migration defines search_schema_health()").not.toBe("");
  const parse = (text: string) => {
    const required = text.match(/required_indexes\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i);
    expect(required, `required_indexes not found in ${definer}`).toBeTruthy();
    const names = [...required![1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    const aliases = text.match(/index_aliases\s+constant\s+jsonb\s*:=\s*jsonb_build_object\(([\s\S]*?)\);/i);
    expect(aliases, `index_aliases not found in ${definer}`).toBeTruthy();
    const aliasNames = [...aliases![1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    return new Set([...names, ...aliasNames]);
  };
  const fromMigration = parse(body);
  // schema.sql must carry the same monitored set — required_indexes changes
  // travel by migration only, never by editing the mirror.
  const schemaMatch = read("supabase/schema.sql").match(definerPattern);
  expect(schemaMatch, "schema.sql does not define search_schema_health()").toBeTruthy();
  const fromSchema = parse(schemaMatch![0]);
  expect([...fromSchema].sort()).toEqual([...fromMigration].sort());
  return { monitored: fromMigration, definer };
}

function loadCoverage(): CoverageFile {
  return JSON.parse(read("supabase/search-health-unmonitored-indexes.json")) as CoverageFile;
}

describe("search_schema_health() index-monitoring ratchet on retrieval-critical tables", () => {
  const scope = new Set<string>(RETRIEVAL_CRITICAL_TABLES);
  const fromMigrations = migrationIndexes();
  const { indexes: fromManifest, primaryKeys } = manifestIndexes();
  const { monitored, definer } = monitoredIndexes();
  const coverage = loadCoverage();

  const candidates = new Map<string, string>();
  for (const [name, table] of fromMigrations)
    if (scope.has(table) && !primaryKeys.has(name)) candidates.set(name, table);
  for (const [name, table] of fromManifest) if (scope.has(table) && !primaryKeys.has(name)) candidates.set(name, table);

  it("parses a plausible inventory (sanity floors)", () => {
    expect(definer).toMatch(/^\d{14}_.+\.sql$/);
    expect(monitored.size).toBeGreaterThanOrEqual(22);
    expect(candidates.size).toBeGreaterThan(40);
    // The manifest and the migration replay largely agree; a wild disagreement
    // means the replay parser or the manifest is broken, not the schema.
    const onlyInMigrations = [...fromMigrations].filter(([n, t]) => scope.has(t) && !fromManifest.has(n));
    const onlyInManifest = [...fromManifest].filter(
      ([n, t]) => scope.has(t) && !fromMigrations.has(n) && !primaryKeys.has(n),
    );
    expect(
      onlyInMigrations.length + onlyInManifest.length,
      `migration-vs-manifest disagreement: ${JSON.stringify({ onlyInMigrations, onlyInManifest })}`,
    ).toBeLessThan(12);
  });

  it("every repo-defined index on a retrieval-critical table is monitored or explicitly listed as unmonitored", () => {
    const listed = new Map(coverage.unmonitored.map((entry) => [entry.index, entry]));
    const uncovered = [...candidates]
      .filter(([name]) => !monitored.has(name) && !listed.has(name))
      .map(([name, table]) => `${table}.${name}`)
      .sort();
    expect(
      uncovered,
      `${uncovered.length} index(es) on retrieval-critical tables are neither in search_schema_health() required_indexes/index_aliases (${definer}) nor listed in supabase/search-health-unmonitored-indexes.json:\n  ${uncovered.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every unmonitored entry is well-formed, current, and not secretly monitored", () => {
    const seen = new Set<string>();
    for (const entry of coverage.unmonitored) {
      const label = `unmonitored entry ${entry.table}.${entry.index}`;
      expect(seen.has(entry.index), `${label} is duplicated`).toBe(false);
      seen.add(entry.index);
      expect(scope.has(entry.table), `${label}: table is outside the retrieval-critical scope`).toBe(true);
      expect(candidates.get(entry.index), `${label}: index is not defined by the repo (stale entry — remove it)`).toBe(
        entry.table,
      );
      expect(
        monitored.has(entry.index),
        `${label}: index IS monitored by search_schema_health — remove the stale entry`,
      ).toBe(false);
      expect(entry.reason?.trim().length ?? 0, `${label}: reason must be a real explanation`).toBeGreaterThan(20);
      expect(["accepted-unmonitored", "monitor-candidate"], `${label}: disposition`).toContain(entry.disposition);
    }
  });

  it("names the section 1.3 absent indexes that fall inside this scope as monitor candidates", () => {
    // Forensics §1.3 (2026-08-14): of the 20 repo-defined indexes absent on live,
    // exactly these three sit on retrieval-critical tables. Until Phase 4 restores
    // them and Phase 4.4 decides required_indexes by migration, they must stay
    // visibly flagged rather than quietly accepted.
    const absentInScope = [
      "document_chunks_anchor_idx",
      "document_index_units_heading_path_idx",
      "documents_registry_projection_lookup_idx",
    ];
    for (const name of absentInScope) {
      const entry = coverage.unmonitored.find((candidate) => candidate.index === name);
      const isMonitored = monitored.has(name);
      expect(
        isMonitored || entry?.disposition === "monitor-candidate",
        `${name} must be monitored or a monitor-candidate`,
      ).toBe(true);
    }
  });
});
