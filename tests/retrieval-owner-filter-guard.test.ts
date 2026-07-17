import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// Guard for the retrieval owner-scope boundary (48h-review finding #3).
//
// The SQL `retrieval_owner_matches(owner_filter, row_owner_id)` now fails CLOSED when
// `owner_filter IS NULL` (migration 20260708160001_retrieval_owner_matches_fail_closed), and
// src/lib/owner-scope.ts no longer emits null — so the database has a real tenant floor. This
// test remains as defense-in-depth on the app side: no `.rpc(...)` call in `src/` may pass a
// *literal* null/undefined `owner_filter`, and every owner_filter value must come from the
// sanctioned scope helpers (which fail closed in production) or the public sentinel — never a
// raw/unaudited value.

const SRC_DIR = join(process.cwd(), "src");
const API_DIR = join(SRC_DIR, "app", "api");

// Keep this deliberately explicit. These are the owner_id-bearing tables queried
// directly by API route modules today. Adding a new owner-scoped table to an API
// handler must also add it here so the tenancy boundary remains reviewable.
const OWNER_SCOPED_API_TABLES = new Set([
  "clinical_registry_record_sources",
  "clinical_registry_records",
  "differential_records",
  "document_index_quality",
  "document_labels",
  "document_summaries",
  "document_table_facts",
  "documents",
  "import_batches",
  "medication_records",
  "rag_answer_feedback",
  "rag_queries",
  "rag_query_misses",
  "rag_retrieval_logs",
  "storage_cleanup_jobs",
]);

const SANCTIONED_API_OWNER_SCOPE = [
  /\bwithOwnerReadScope\s*\(/,
  /\.eq\(\s*["']owner_id["']\s*,/,
  /\.eq\(\s*["']documents\.owner_id["']\s*,/,
  /\brequireOwnedDocument\s*\(/,
  /\bloadOwnedDocument\s*\(/,
  /\brequireOwnerScope\s*\(/,
  /\bretrievalOwnerFilter\s*\(/,
  /\b(?:p_)?owner_id\s*:/,
];

// setup-status performs bounded schema/existence probes and never returns table
// rows. It is intentionally owner-agnostic so a fresh deployment can diagnose
// missing setup before any user corpus exists.
const OWNER_SCOPE_EXEMPTIONS = new Set(["setup-status/route.ts:documents", "setup-status/route.ts:import_batches"]);

// These internal helpers consume owner-authorized capability IDs created by the
// surrounding route; they are not request-entry reads. Keep the names explicit so
// moving either query to a new helper or route forces a tenancy review.
const OWNER_SCOPED_HELPER_EXEMPTIONS = new Set([
  "documents/[id]/labels/route.ts:document_labels:selectLabels",
  "documents/[id]/route.ts:storage_cleanup_jobs:updateStorageCleanupJob",
]);

// Sanctioned right-hand sides for an `owner_filter` / `p_owner_filter` RPC argument.
const SANCTIONED_SOURCES = [
  /^retrievalOwnerFilter\(/,
  /^requireOwnerScope\(/,
  /^ownerScopeForDocumentFilteredRetrieval\(/,
  /^PUBLIC_OWNER_FILTER_SENTINEL\b/,
  // corpus-grounding threads through the exact scope it was handed; documented safe because rag.ts
  // derives `args.ownerFilter` from ownerScopeForDocumentFilteredRetrieval (never a raw null in prod).
  /^args\.ownerFilter\b/,
  // Versioned-RPC rollout adapters derive these locals from RetrievalAccessScope before
  // issuing exact-owner and public-sentinel legacy calls.
  /^ownerFilter\b/,
  /^scope\.ownerId\b/,
  /^accessScope\.ownerId\b/,
];

const OWNER_FILTER_ARG = /\b(?:p_)?owner_filter\s*:\s*(.+?)\s*,?\s*$/;

function sourceFiles(dir: string): string[] {
  // `recursive: true` without `withFileTypes` returns relative paths as strings — avoids the
  // Dirent.parentPath/path typing churn across @types/node versions.
  return readdirSync(dir, { recursive: true })
    .map((entry) => String(entry))
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !name.includes("database.types"))
    .map((name) => join(dir, name));
}

function apiRouteFiles(): string[] {
  return sourceFiles(API_DIR).filter((file) => file.replace(/\\/g, "/").endsWith("/route.ts"));
}

function nearestFunctionOrSource(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node;
  while (current?.parent) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return current ?? node;
}

function functionName(node: ts.Node) {
  const scope = nearestFunctionOrSource(node);
  return ts.isFunctionDeclaration(scope) && scope.name ? scope.name.text : null;
}

function directTableNames(file: string, source: string) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tables = new Set<string>();

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      tables.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(parsed);
  return tables;
}

function ownerIdTablesFromDatabaseTypes() {
  const lines = readFileSync(join(SRC_DIR, "lib", "supabase", "database.types.ts"), "utf8").split(/\r?\n/);
  const tables = new Set<string>();
  let table: string | null = null;
  let inRow = false;

  for (const line of lines) {
    const tableMatch = line.match(/^      ([a-z0-9_]+): \{$/);
    if (tableMatch) {
      table = tableMatch[1];
      inRow = false;
    } else if (table && /^        Row: \{$/.test(line)) {
      inRow = true;
    } else if (/^        Insert: \{$/.test(line)) {
      inRow = false;
    } else if (table && inRow && /^          owner_id:/.test(line)) {
      tables.add(table);
    }
  }

  return tables;
}

function ownerScopedApiAccesses(file: string, source: string): { checked: number; offenders: string[] } {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relativeFile = file.slice(API_DIR.length + 1).replace(/\\/g, "/");
  const offenders: string[] = [];
  let checked = 0;

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const table = node.arguments[0].text;
      if (OWNER_SCOPED_API_TABLES.has(table)) {
        checked += 1;
        const exemptionKey = `${relativeFile}:${table}`;
        const helperExemptionKey = `${exemptionKey}:${functionName(node) ?? ""}`;
        if (!OWNER_SCOPE_EXEMPTIONS.has(exemptionKey) && !OWNER_SCOPED_HELPER_EXEMPTIONS.has(helperExemptionKey)) {
          const scope = nearestFunctionOrSource(node).getText(parsed);
          if (!SANCTIONED_API_OWNER_SCOPE.some((pattern) => pattern.test(scope))) {
            const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
            offenders.push(`${relativeFile}:${line} — ${table} access has no sanctioned owner-scope helper/filter`);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(parsed);
  return { checked, offenders };
}

describe("retrieval owner_filter callsite guard (finding #3)", () => {
  it("routes every owner_filter RPC argument through a sanctioned scope source (never literal null)", () => {
    const offenders: string[] = [];
    let checked = 0;

    for (const file of sourceFiles(SRC_DIR)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        const match = trimmed.match(OWNER_FILTER_ARG);
        if (!match) return;

        checked += 1;
        const rhs = match[1].trim();
        const location = `${file.replace(process.cwd(), "").replace(/\\/g, "/")}:${index + 1}`;
        if (/^(null|undefined)\b/.test(rhs)) {
          offenders.push(`${location} — literal ${rhs}`);
        } else if (!SANCTIONED_SOURCES.some((pattern) => pattern.test(rhs))) {
          offenders.push(`${location} — unsanctioned owner_filter source: ${rhs}`);
        }
      });
    }

    // Fail loudly if the scan matched nothing (e.g. the RPC param was renamed) rather than passing vacuously.
    expect(
      checked,
      "found no owner_filter RPC callsites to guard — has the param name changed?",
    ).toBeGreaterThanOrEqual(5);
    expect(
      offenders,
      `owner_filter must come from retrievalOwnerFilter / requireOwnerScope / ` +
        `ownerScopeForDocumentFilteredRetrieval / PUBLIC_OWNER_FILTER_SENTINEL — never a raw or null value:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("owner-scoped API table guard", () => {
  it("recognizes sanctioned helpers and rejects an unscoped handler", () => {
    const safe = ownerScopedApiAccesses(
      join(API_DIR, "synthetic-safe", "route.ts"),
      `export async function GET() {
        return withOwnerReadScope(supabase.from("documents").select("id"), access.ownerId);
      }`,
    );
    const unsafe = ownerScopedApiAccesses(
      join(API_DIR, "synthetic-unsafe", "route.ts"),
      `export async function GET() {
        return supabase.from("documents").select("id");
      }`,
    );

    expect(safe).toEqual({ checked: 1, offenders: [] });
    expect(unsafe.checked).toBe(1);
    expect(unsafe.offenders).toHaveLength(1);
  });

  it("keeps the explicit table list aligned with generated owner_id table types", () => {
    const directApiTables = new Set<string>();
    for (const file of apiRouteFiles()) {
      for (const table of directTableNames(file, readFileSync(file, "utf8"))) directApiTables.add(table);
    }
    const typedOwnerTables = ownerIdTablesFromDatabaseTypes();
    const expected = [...directApiTables].filter((table) => typedOwnerTables.has(table)).sort();
    const configured = [...OWNER_SCOPED_API_TABLES].sort();

    expect(
      configured,
      "OWNER_SCOPED_API_TABLES must exactly match owner_id tables directly queried by API routes.",
    ).toEqual(expected);
  });

  it("keeps every direct owner-scoped API table access behind a sanctioned scope", () => {
    const offenders: string[] = [];
    let checked = 0;

    for (const file of apiRouteFiles()) {
      const result = ownerScopedApiAccesses(file, readFileSync(file, "utf8"));
      checked += result.checked;
      offenders.push(...result.offenders);
    }

    expect(checked, "found no owner-scoped API table accesses — is the explicit table list stale?").toBeGreaterThan(0);
    expect(
      offenders,
      `Owner-scoped API table access must use withOwnerReadScope, an explicit owner_id filter/stamp, ` +
        `an owned-document helper, or a documented narrow exemption:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
