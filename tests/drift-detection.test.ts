import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareDriftSnapshots, normalizedSchemaSha256 } from "../scripts/check-drift";

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

describe("drift manifest freshness (offline half of check:drift)", () => {
  it("supabase/drift-manifest.json was generated from the current supabase/schema.sql", () => {
    const manifest = JSON.parse(read("supabase/drift-manifest.json"));
    expect(
      manifest.schema_sha256,
      "supabase/schema.sql changed without regenerating the drift manifest. Run: npm run drift:manifest (requires Docker).",
    ).toBe(normalizedSchemaSha256(read("supabase/schema.sql")));
  });

  it("manifest snapshot carries every inventory category", () => {
    const { snapshot } = JSON.parse(read("supabase/drift-manifest.json"));
    for (const category of [
      "extensions",
      "tables",
      "views",
      "functions",
      "indexes",
      "policies",
      "constraints",
      "triggers",
      "storage_buckets",
    ]) {
      expect(Array.isArray(snapshot[category]), `manifest.snapshot.${category} missing`).toBe(true);
      expect((snapshot[category] as unknown[]).length, `manifest.snapshot.${category} empty`).toBeGreaterThan(0);
    }
    // Full-inventory sanity: the app schema is large; a tiny snapshot means the
    // replay silently failed rather than schema.sql shrinking by 10x.
    expect((snapshot.functions as unknown[]).length).toBeGreaterThan(40);
    expect((snapshot.indexes as unknown[]).length).toBeGreaterThan(100);
    expect((snapshot.tables as unknown[]).length).toBeGreaterThan(30);
  });
});

describe("schema_drift_snapshot definition parity (migration vs schema.sql)", () => {
  const extract = (text: string) => {
    const start = text.indexOf("create or replace function public.schema_drift_snapshot()");
    expect(start, "schema_drift_snapshot definition not found").toBeGreaterThanOrEqual(0);
    const end = text.indexOf("grant execute on function public.schema_drift_snapshot() to service_role;", start);
    expect(end, "schema_drift_snapshot grants not found").toBeGreaterThan(start);
    return text.slice(start, end);
  };

  it("migration 20260706200000 and schema.sql carry byte-identical definitions", () => {
    const fromMigration = extract(read("supabase/migrations/20260706200000_schema_drift_snapshot.sql"));
    const fromSchema = extract(read("supabase/schema.sql"));
    expect(fromSchema).toBe(fromMigration);
  });
});

describe("drift allowlist hygiene", () => {
  const allowlist = JSON.parse(read("supabase/drift-allowlist.json")) as {
    entries: { category: string; kind: string; key: string; live_key?: string; reason: string }[];
  };

  it("every entry is well-formed with a real reason", () => {
    expect(allowlist.entries.length).toBeGreaterThan(0);
    for (const entry of allowlist.entries) {
      expect([
        "extensions",
        "tables",
        "views",
        "functions",
        "indexes",
        "policies",
        "constraints",
        "triggers",
        "storage_buckets",
      ]).toContain(entry.category);
      expect(["missing_live", "unexpected_live", "mismatch", "alias"]).toContain(entry.kind);
      expect(entry.key.length).toBeGreaterThan(0);
      expect(entry.reason.length, `allowlist entry ${entry.category}/${entry.key} needs a reason`).toBeGreaterThan(20);
      expect(entry.reason).not.toContain("UNCLASSIFIED");
      if (entry.kind === "alias") {
        expect(entry.live_key, `alias entry ${entry.key} needs live_key`).toBeTruthy();
      }
    }
  });

  it("has no duplicate entries", () => {
    const seen = new Set<string>();
    for (const entry of allowlist.entries) {
      const id = `${entry.category}|${entry.kind}|${entry.key}|${entry.live_key ?? ""}`;
      expect(seen.has(id), `duplicate allowlist entry: ${id}`).toBe(false);
      seen.add(id);
    }
  });
});

describe("compareDriftSnapshots", () => {
  const base = {
    extensions: [{ name: "vector", schema: "extensions" }],
    tables: [
      {
        name: "documents",
        rls_enabled: true,
        rls_forced: false,
        reloptions: null,
        acl: ["postgres=arwdDxtm/postgres"],
        columns: [{ name: "id", type: "uuid", not_null: true, identity: "", generated: "", default: null }],
      },
    ],
    views: [],
    functions: [{ signature: "public.fn()", def_hash: "aaa", acl: ["postgres=X/postgres"] }],
    indexes: [
      {
        name: "documents_pkey",
        table: "documents",
        def: "CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id)",
        def_hash: "h1",
      },
    ],
    policies: [],
    constraints: [],
    triggers: [],
    storage_buckets: [],
  };
  const clone = () => JSON.parse(JSON.stringify(base));

  it("reports nothing when snapshots match", () => {
    const r = compareDriftSnapshots(clone(), clone(), []);
    expect(r.findings).toEqual([]);
    expect(r.staleEntries).toEqual([]);
  });

  it("detects mismatches, missing and unexpected objects", () => {
    const live = clone();
    live.functions[0].def_hash = "bbb";
    live.indexes = [];
    live.tables.push({ ...base.tables[0], name: "rogue_table" });
    const r = compareDriftSnapshots(clone(), live, []);
    const kinds = r.findings.map(
      (f: { category: string; kind: string; key: string }) => `${f.category}:${f.kind}:${f.key}`,
    );
    expect(kinds).toContain("functions:mismatch:public.fn()");
    expect(kinds).toContain("indexes:missing_live:documents_pkey");
    expect(kinds).toContain("tables:unexpected_live:rogue_table");
    expect(r.findings).toHaveLength(3);
  });

  it("treats extra live extensions as informational, missing ones as findings", () => {
    const live = clone();
    live.extensions = [{ name: "pg_net", schema: "extensions" }];
    const r = compareDriftSnapshots(clone(), live, []);
    expect(r.infos.some((i: string) => i.includes("pg_net"))).toBe(true);
    expect(r.findings.map((f: { key: string }) => f.key)).toContain("vector");
  });

  it("allowlist consumes matching findings and reports stale entries", () => {
    const live = clone();
    live.functions[0].def_hash = "bbb";
    const entries = [
      { category: "functions", kind: "mismatch", key: "public.fn()", reason: "pending migration" },
      { category: "tables", kind: "mismatch", key: "documents", reason: "no longer true" },
    ] as never[];
    const r = compareDriftSnapshots(clone(), live, entries);
    expect(r.findings).toEqual([]);
    expect(r.allowed).toHaveLength(1);
    expect(r.staleEntries).toHaveLength(1);
  });

  it("alias entries require an identical name-stripped definition on the same table", () => {
    const expected = clone();
    const live = clone();
    live.indexes = [
      {
        name: "documents_pkey_legacy",
        table: "documents",
        def: "CREATE UNIQUE INDEX documents_pkey_legacy ON public.documents USING btree (id)",
        def_hash: "h2",
      },
    ];
    const alias = [
      {
        category: "indexes",
        kind: "alias",
        key: "documents_pkey",
        live_key: "documents_pkey_legacy",
        reason: "legacy live name x",
      },
    ] as never[];
    const r = compareDriftSnapshots(expected, live, alias);
    expect(r.findings).toEqual([]);
    expect(r.allowed).toHaveLength(2); // consumes missing_live + unexpected_live

    // A legacy index with a DIFFERENT shape must NOT satisfy the alias.
    const badLive = clone();
    badLive.indexes = [
      {
        name: "documents_pkey_legacy",
        table: "documents",
        def: "CREATE INDEX documents_pkey_legacy ON public.documents USING btree (created_at)",
        def_hash: "h3",
      },
    ];
    const r2 = compareDriftSnapshots(expected, badLive, alias);
    expect(r2.findings.map((f: { kind: string }) => f.kind)).toContain("missing_live");
  });
});
