import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUARD_CONTRACT_VERSION,
  HISTORY_GUARD_CLASSES,
  HISTORY_PROBE_MIGRATION,
  historyEntryProblems,
  type AllowlistEntry,
} from "../scripts/check-drift";

/**
 * Guard-migration contract (docs/database-drift-detection.md, plan phase 6.2).
 *
 * Every `migration_history` allowlist entry — a supabase_migrations version the
 * live probe reports as recorded WITHOUT executed statements — must point at a
 * guard migration that really covers it:
 *   validation  a later fail-fast validation migration (20260804110240 pattern)
 *               that raises when the listed objects are missing/invalid;
 *   superseded  a later migration that re-created every listed object
 *               (pre-contract history only);
 *   no_ddl      the version's own file, which has no effect at all.
 * check:drift enforces the structural half at runtime (an invalid entry can
 * never silence a row); this test enforces the object-level half offline so a
 * pointer to the wrong file cannot pass review as a "guard".
 */

const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");
const readMigration = (fileName: string) => readFileSync(join(migrationsDir, fileName), "utf8");

const allowlist = JSON.parse(read("supabase/drift-allowlist.json")) as { entries: AllowlistEntry[] };
const historyEntries = allowlist.entries.filter((entry) => entry.category === "migration_history");
const migrationFiles = readdirSync(migrationsDir).filter((name) => /^\d{14}_.+\.sql$/.test(name));

const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does `sql` create/replace `object` (function, index, table, view, policy, trigger)? */
function createsObject(sql: string, object: string): boolean {
  const name = escape(object);
  const patterns = [
    new RegExp(`create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${name}\\s*\\(`, "i"),
    new RegExp(`create\\s+function\\s+(?:public\\.)?${name}\\s*\\(`, "i"),
    new RegExp(
      `create\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?${name}\\s+on\\b`,
      "i",
    ),
    new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${name}\\s*\\(`, "i"),
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+)?view\\s+(?:public\\.)?${name}\\b`, "i"),
    new RegExp(`create\\s+policy\\s+"?${name}"?\\s+on\\b`, "i"),
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?trigger\\s+${name}\\b`, "i"),
  ];
  return patterns.some((pattern) => pattern.test(sql));
}

/** SQL with block/line comments removed and whitespace collapsed. */
function stripSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Executable SQL only: comments and single-quoted string literals removed, except
 * when passed dynamically to EXECUTE. A validation guard pins the canonical
 * `create index … on …` text of the objects it proves as a data literal (the
 * 20260804110240 pattern), which must not be mistaken for a build; but dynamic
 * EXECUTE of CREATE INDEX statements must still be caught.
 */
function executableSql(sql: string): string {
  const stripped = stripSql(sql);
  let out = "";
  let inExecute = false;
  let i = 0;

  while (i < stripped.length) {
    // Check for string literal
    if (stripped[i] === "'") {
      let literal = "";
      i++; // skip opening quote
      while (i < stripped.length) {
        if (stripped[i] === "'") {
          if (stripped[i + 1] === "'") {
            literal += "'";
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          literal += stripped[i];
          i++;
        }
      }

      if (inExecute) {
        out += " " + literal + " ";
      } else {
        out += "''";
      }
      continue;
    }

    // Check for dollar-quoted string opening $tag$
    if (stripped[i] === "$") {
      const match = stripped.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        inExecute = false;
        out += tag;
        i += tag.length;
        continue;
      }
    }

    // Check for dynamic EXECUTE keyword (excluding GRANT/REVOKE EXECUTE and EXECUTE FUNCTION/PROCEDURE)
    const rest = stripped.slice(i);
    const executeMatch = rest.match(/^execute\b(?!\s+(?:function|procedure)\b)/i);
    if (executeMatch) {
      const prefix = stripped.slice(Math.max(0, i - 15), i);
      if (!/\b(?:grant|revoke)\s+$/i.test(prefix)) {
        inExecute = true;
      }
      out += rest.slice(0, executeMatch[0].length);
      i += executeMatch[0].length;
      continue;
    }

    // If inside EXECUTE, check for clause terminators or string concatenation
    if (inExecute) {
      if (rest.match(/^\|\|/)) {
        out += " ";
        i += 2;
        continue;
      }
      const termMatch = rest.match(/^(?:into\b|using\b|;|end\b)/i);
      if (termMatch) {
        inExecute = false;
        out += rest.slice(0, termMatch[0].length);
        i += termMatch[0].length;
        continue;
      }
    }

    out += stripped[i];
    i++;
  }

  return out;
}

const CREATE_INDEX_STATEMENT =
  /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:[a-z0-9_%"]|\$)/i;

describe("migration-history probe and guard-migration contract", () => {
  it("the v2 snapshot migration exists and check:drift knows its name", () => {
    expect(existsSync(join(migrationsDir, HISTORY_PROBE_MIGRATION))).toBe(true);
    expect(read("scripts/check-drift.ts")).toContain("migration_history");
    expect(read("scripts/check-drift.ts")).toContain("no_statements");
  });

  it("the contract is written down where operators and agents will read it", () => {
    const doc = read("docs/database-drift-detection.md");
    expect(doc).toContain("## Guard-migration contract");
    expect(doc).toContain("## Migration-history probe");
    expect(doc).toContain("## Runtime index-monitoring ratchet");
    expect(doc).toMatch(/fail-fast\s+validation\s+(guard\s+)?migration/i);
    expect(doc).toContain("20260804110240");
    expect(doc).toContain("migration_history");
    expect(read("AGENTS.md")).toContain("docs/database-drift-detection.md");
  });

  it("the guard classes are exactly the documented set and the contract date is fixed", () => {
    expect([...HISTORY_GUARD_CLASSES]).toEqual(["validation", "superseded", "no_ddl"]);
    expect(GUARD_CONTRACT_VERSION).toBe("20260818000000");
  });

  it("every allowlisted no-statements version passes the structural guard validation", () => {
    for (const entry of historyEntries) {
      expect(historyEntryProblems(entry), `allowlist entry ${entry.key}`).toEqual([]);
    }
  });

  it("every allowlisted no-statements version has a matching guard migration file that really covers it", () => {
    for (const entry of historyEntries) {
      const guard = entry.guard!;
      const label = `allowlist entry ${entry.key} (${guard.class} → ${guard.migration})`;
      expect(migrationFiles, `${label}: guard file missing`).toContain(guard.migration);
      const guardSql = readMigration(guard.migration);

      if (guard.class === "validation") {
        // A validation guard never builds: it raises when the objects are
        // missing/invalid/mismatched (the 20260804110240 pattern).
        expect(guardSql, `${label}: validation guard must raise`).toMatch(/raise\s+exception/i);
        expect(
          executableSql(guardSql),
          `${label}: validation guard must not create the objects it validates`,
        ).not.toMatch(CREATE_INDEX_STATEMENT);
        expect(guardSql, `${label}: validation guard must scope its timeouts with set local`).toMatch(
          /set\s+local\s+statement_timeout/i,
        );
        for (const object of guard.objects ?? []) {
          expect(guardSql, `${label}: guard does not mention object ${object}`).toContain(object);
        }
      } else if (guard.class === "superseded") {
        expect(guard.objects?.length, `${label}: superseded guard must list the objects it re-creates`).toBeGreaterThan(
          0,
        );
        for (const object of guard.objects ?? []) {
          expect(createsObject(guardSql, object), `${label}: guard does not re-create ${object}`).toBe(true);
        }
        // The version's own file must define at least the objects claimed —
        // otherwise the entry is describing the wrong version.
        const own = migrationFiles.find((name) => name.startsWith(`${entry.key}_`));
        expect(own, `${label}: the allowlisted version has no local migration file`).toBeTruthy();
        for (const object of guard.objects ?? []) {
          expect(createsObject(readMigration(own!), object), `${label}: ${own} does not define ${object}`).toBe(true);
        }
      } else if (guard.class === "no_ddl") {
        const body = stripSql(guardSql);
        expect(
          body === "" || /^select\s+1\s*;?$/i.test(body),
          `${label}: no_ddl guard has effective SQL: ${body.slice(0, 80)}`,
        ).toBe(true);
      }
    }
  });

  it("the reference validation guard 20260804110240 satisfies the validation predicate", () => {
    // The pattern every validation guard copies pins canonical `create index …`
    // text inside string literals; the executable-SQL check must keep accepting
    // it while still rejecting a real build statement.
    const reference = readMigration("20260804110240_restore_rag_search_health_indexes.sql");
    expect(reference).toMatch(/raise\s+exception/i);
    expect(executableSql(reference)).not.toMatch(CREATE_INDEX_STATEMENT);
    expect(executableSql(`${reference}\ncreate index if not exists oops_idx on public.documents(id);`)).toMatch(
      CREATE_INDEX_STATEMENT,
    );
    expect(
      executableSql(
        `${reference}\ndo $$ begin execute 'create index if not exists oops_idx on public.documents(id);'; end $$;`,
      ),
    ).toMatch(CREATE_INDEX_STATEMENT);
    expect(
      executableSql(
        `${reference}\ndo $$ begin execute format('create index %I on public.documents(id)', 'oops_idx'); end $$;`,
      ),
    ).toMatch(CREATE_INDEX_STATEMENT);
    expect(
      executableSql(
        `${reference}\ndo $$ begin execute 'create ' || 'unique index concurrently if not exists oops_idx on public.documents(id);'; end $$;`,
      ),
    ).toMatch(CREATE_INDEX_STATEMENT);
  });

  it("no pre-contract class is used for a version at or after the contract date", () => {
    for (const entry of historyEntries) {
      if (entry.key >= GUARD_CONTRACT_VERSION) {
        expect(entry.guard?.class, `allowlist entry ${entry.key} must use a validation guard`).toBe("validation");
      }
    }
  });

  it("the seeded entries resolve to the section 1.1 mark-applied cluster by name", () => {
    // Guards against a typo in the version key: each seeded version must have a
    // local file whose stem is one of the names the forensics file recorded.
    const forensics = read("docs/audit/live-drift-forensics-2026-08.md");
    for (const entry of historyEntries) {
      const own = migrationFiles.find((name) => name.startsWith(`${entry.key}_`));
      expect(own, `allowlist entry ${entry.key} has no local migration`).toBeTruthy();
      const stem = own!.replace(/^\d{14}_/, "").replace(/\.sql$/, "");
      expect(forensics, `${own} is not a name recorded in forensics §1.1`).toContain(`\`${stem}\``);
    }
  });
});
