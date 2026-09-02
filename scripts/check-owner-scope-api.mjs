#!/usr/bin/env node
// Defense-in-depth tenancy guard (audit finding D2 / M6).
//
// The app is a deliberately single-layer tenancy design: every API route uses the
// service-role Supabase client (RLS bypassed) and enforces ownership in application
// code via an `owner_id` filter. `docs/audit/tenancy-defense-in-depth-review.md` verified
// 0/33 route gaps, but flagged (§6 item 2) that a *future* handler dropping the owner
// filter is the single regression class this design is exposed to.
//
// This guard closes that class statically. It runs in TWO phases, and both must pass:
//
// PHASE 1 (this file) — the handler-level regex sweep. It fails when a `src/app/api/**`
// handler queries an OWNER-SCOPED table (any table with an `owner_id` column in
// supabase/schema.sql) without a recognised owner-scoping construct in the enclosing
// handler — `.eq("owner_id"...)`, `withOwnerReadScope`, `requireOwnerScope`,
// `requireOwnedDocument`/`loadOwnedDocument`/`ownedDocumentId`, a `documents!inner`
// + `documents.owner_id` join, or an `owner_id:` write payload. Intentional
// exceptions (indirect scoping the reviewer confirmed safe) live in
// OWNER_SCOPE_ALLOWLIST with a reason. This phase is deliberately coarse: it does not
// parse TypeScript, it considers only owner_id-bearing tables, and it attributes scope
// per HANDLER rather than per query. It is kept as a cheap, independent second opinion.
//
// PHASE 2 (scripts/lib/tenancy-scan.mjs) — the mechanical AST scan, shared verbatim with
// tests/retrieval-owner-filter-guard.test.ts so the two guards cannot drift apart. It is
// strictly stronger than phase 1 on every axis phase 1 covers, and it closes five things
// phase 1 structurally cannot see (see that module's header for the full rationale):
//   A  join-through tables (`document_chunks`, `document_pages`, `document_images`,
//      `ingestion_jobs`, …) have no `owner_id` column, so phase 1 ignores them entirely —
//      including in its own self-test below, which still asserts `document_chunks` is not
//      flagged. Phase 2 gives them a declared, reviewed inventory instead.
//   B  `user_id` tenancy (`user_favourites`, `user_favourite_sets`, `user_preferences`).
//   C  scope attributed per QUERY CHAIN, not per function.
//   D  a wider file set: every `.ts` under `src/app/api` plus a named list of server-side
//      read modules outside it.
//   E  the one dynamic `.rpc()` dispatcher, `callVersionedRetrievalRpc`.
// The two phases share no code and no allowlist; a table tier in one must never contradict
// the other, which is why phase 2 derives its tiers from src/lib/supabase/database.types.ts
// rather than restating them here.
//
// Usage:
//   node scripts/check-owner-scope-api.mjs             scan the repo; exit 1 on any violation
//   node scripts/check-owner-scope-api.mjs --self-test run the synthetic pass/fail fixtures

import { readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { emptyTierNames, scanRpcDispatch, scanTenancy } from "./lib/tenancy-scan.mjs";

// Recognised owner-scoping constructs. If any appears in the enclosing handler of an
// owner-scoped `.from(...)`, that query is considered scoped. `owner_id` (as a substring)
// covers `.eq("owner_id"...)`, `.is("owner_id"...)`, `.or("owner_id.eq...")`, insert/update
// `owner_id:` payloads, and `documents.owner_id` inner-join predicates. The named helpers
// cover the cases where scoping is delegated to a shared primitive.
const SCOPE_TOKENS = [
  "owner_id",
  "withOwnerReadScope",
  "requireOwnerScope",
  "retrievalOwnerFilter",
  "requireOwnedDocument",
  "loadOwnedDocument",
  "ownedDocumentId",
  "assertGlobalSearchAllowed",
  "resolveSearchScope",
];

// Intentional exceptions: a handler that queries an owner-scoped table where ownership
// is enforced indirectly (e.g. the query filters by document ids that were themselves
// fetched under an owner scope). Each entry needs a reason and a reviewer sign-off in
// docs/audit/tenancy-defense-in-depth-review.md. Keep this list empty unless a real, reviewed
// indirect-scope pattern exists — a forgotten filter must NOT be silenced here.
export const OWNER_SCOPE_ALLOWLIST = [
  {
    file: "src/app/api/setup-status/route.ts",
    table: "documents",
    reason:
      "Global setup/health diagnostic: a `.limit(1)` existence probe (is any document indexed?), not an owner-data read. The route is gated to local origin and returns only status booleans — see docs/audit/tenancy-defense-in-depth-review.md §3 (setup-status row / TEN-N1).",
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "import_batches",
    reason:
      "Global setup/health diagnostic: a `.limit(1)` existence probe for schema provisioning, not an owner-data read. Same local-origin-gated status route — see docs/audit/tenancy-defense-in-depth-review.md §3 (TEN-N1).",
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "storage_cleanup_jobs",
    reason:
      "Global setup/health diagnostic: a head-count existence probe for pending cleanup rows (schema/ops posture), not an owner-data read. Same local-origin-gated status route — see docs/audit/tenancy-defense-in-depth-review.md §3 (TEN-N1).",
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_answer_feedback",
    reason:
      "Administrator-only clinical-quality aggregate. GET and PATCH call authorizeAndLimit before these helpers run; they return governance metadata, never raw question, answer, excerpt, or patient text. Per-owner filtering would defeat the cross-tenant quality-control purpose — see docs/audit/tenancy-defense-in-depth-review.md §6.",
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "clinical_registry_record_sources",
    reason:
      "Administrator-only clinical-quality aggregate. GET and PATCH call authorizeAndLimit before these helpers run; they return governance metadata, never raw question, answer, excerpt, or patient text. Per-owner filtering would defeat the cross-tenant quality-control purpose — see docs/audit/tenancy-defense-in-depth-review.md §6.",
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "clinical_registry_records",
    reason:
      "Administrator-only clinical-quality aggregate. GET and PATCH call authorizeAndLimit before these helpers run; they return governance metadata, never raw question, answer, excerpt, or patient text. Per-owner filtering would defeat the cross-tenant quality-control purpose — see docs/audit/tenancy-defense-in-depth-review.md §6.",
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_retrieval_logs",
    reason:
      "Administrator-only clinical-quality aggregate. GET and PATCH call authorizeAndLimit before these helpers run; they return governance metadata, never raw question, answer, excerpt, or patient text. Per-owner filtering would defeat the cross-tenant quality-control purpose — see docs/audit/tenancy-defense-in-depth-review.md §6.",
  },
];

/** Extract table names that declare an `owner_id` column from supabase/schema.sql. */
export function ownerScopedTablesFromSchema(schemaText) {
  const tables = new Set();
  let current = null;
  for (const raw of schemaText.split("\n")) {
    const line = raw.trim();
    const createMatch = line.match(/^create table (?:if not exists )?public\.([a-z0-9_]+)/i);
    if (createMatch) {
      current = createMatch[1];
      continue;
    }
    if (!current) continue;
    // A column definition named owner_id (not a comment, not a cross-table reference).
    if (/^owner_id\b/.test(line)) tables.add(current);
    // End of the CREATE TABLE statement.
    if (line === ");" || line.startsWith(") ")) current = null;
  }
  return tables;
}

/**
 * Split source into top-level declaration segments so a `.from(...)` can be checked against only
 * its enclosing handler's text.
 *
 * Boundaries are **column-0 (top-level) declarations only** — nested functions are indented in
 * this Prettier-formatted codebase and therefore never split a handler body. This is the fix for
 * the finding that a nested helper inside a handler used to spill the code after it into a
 * separate non-handler segment, which then fell back to whole-file scope and let an `owner_id`
 * token elsewhere in the file mask a genuinely-unscoped query. Anchoring to column 0 keeps every
 * statement lexically inside the handler that encloses it, without fragile brace/string matching.
 */
const HANDLER_START = /^export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;

// A top-level `function`/`const` declaration (no leading indentation → column 0). Nested
// declarations are indented and are intentionally NOT boundaries.
const TOP_LEVEL_DECL = /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?const\s+\w+\s*=/;

function functionSegments(text) {
  const lines = text.split("\n");
  const starts = [];
  lines.forEach((line, i) => {
    if (TOP_LEVEL_DECL.test(line)) starts.push(i);
  });
  if (starts.length === 0) return [{ startLine: 0, text, isHandler: false }];
  const segments = [];
  // Anything before the first declaration (imports/consts) — its own segment.
  if (starts[0] > 0) segments.push({ startLine: 0, text: lines.slice(0, starts[0]).join("\n"), isHandler: false });
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    segments.push({
      startLine: from,
      text: lines.slice(from, to).join("\n"),
      isHandler: HANDLER_START.test(lines[from]),
    });
  }
  return segments;
}

function isAllowlisted(file, table) {
  return OWNER_SCOPE_ALLOWLIST.some((e) => e.file === file && e.table === table);
}

/**
 * Find owner-scope violations in a single file.
 * @returns {{file:string,table:string,line:number}[]}
 */
export function analyzeFile(file, text, ownerTables) {
  const violations = [];
  const segments = functionSegments(text);
  const fromRe = /\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)/g;
  let m;
  while ((m = fromRe.exec(text)) !== null) {
    const table = m[1];
    if (!ownerTables.has(table)) continue;
    if (isAllowlisted(file, table)) continue;
    const lineNo = text.slice(0, m.index).split("\n").length;
    const segment = segments.find((seg) => {
      const segEndLine = seg.startLine + seg.text.split("\n").length;
      return lineNo - 1 >= seg.startLine && lineNo - 1 < segEndLine;
    });
    // Route handlers are checked strictly against their own (column-0-bounded) body, so a
    // scoping construct in one handler cannot excuse an unscoped query in a sibling handler.
    // Queries inside in-file helpers (or top-level) fall back to the whole file, because their
    // ownership is enforced by the handler(s) that call them within the same file (e.g. a
    // `selectLabels` helper reached only after `requireOwnedDocument`).
    const scopeText = segment && segment.isHandler ? segment.text : text;
    const scoped = SCOPE_TOKENS.some((tok) => scopeText.includes(tok));
    if (!scoped) violations.push({ file, table, line: lineNo });
  }
  return violations;
}

/** Scan every tracked src/app/api file for owner-scope violations. */
export function scanRepo({ schemaText, files }) {
  const ownerTables = ownerScopedTablesFromSchema(schemaText);
  const violations = [];
  for (const { path, text } of files) {
    violations.push(...analyzeFile(path, text, ownerTables));
  }
  return { ownerTables, violations };
}

function readTrackedApiFiles() {
  // execFile (fixed argv, no shell) rather than execSync with a command string.
  const listed = execFileSync("git", ["ls-files", "src/app/api"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f));
  return listed
    .map((path) => {
      try {
        return { path, text: readFileSync(path, "utf8") };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function runSelfTest() {
  const ownerTables = new Set(["documents"]);
  const failures = [];
  const expect = (cond, label) => {
    if (!cond) failures.push(label);
  };

  // A brand-new handler that forgets the owner filter must be flagged.
  const unscoped = `export async function GET(request) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("documents").select("*");
    return NextResponse.json({ data });
  }`;
  expect(analyzeFile("fixture-unscoped.ts", unscoped, ownerTables).length === 1, "unscoped handler should be flagged");

  // A handler with an explicit owner filter must pass.
  const scopedEq = `export async function GET(request) {
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data } = await supabase.from("documents").select("*").eq("owner_id", user.id);
    return NextResponse.json({ data });
  }`;
  expect(analyzeFile("fixture-eq.ts", scopedEq, ownerTables).length === 0, "eq(owner_id) handler should pass");

  // A handler using the shared read-scope helper must pass.
  const scopedHelper = `export async function GET(request) {
    const supabase = createAdminClient();
    const { data } = await withOwnerReadScope(supabase.from("documents").select("*"), access.ownerId);
    return NextResponse.json({ data });
  }`;
  expect(
    analyzeFile("fixture-helper.ts", scopedHelper, ownerTables).length === 0,
    "withOwnerReadScope handler should pass",
  );

  // Scoping in one handler must NOT excuse an unscoped query in a sibling handler.
  const twoHandlers = `${scopedEq}\n${unscoped}`;
  expect(
    analyzeFile("fixture-two.ts", twoHandlers, ownerTables).length === 1,
    "per-handler: sibling unscoped query still flagged",
  );

  // Column-0 handler boundaries: a nested arrow helper inside POST must not split the handler
  // body into a whole-file fallback that GET's owner filter would satisfy.
  const nestedLeak = [
    "export async function GET(request) {",
    "  const user = await auth(request);",
    '  return supabase.from("documents").select("*").eq("owner_id", user.id);',
    "}",
    "export async function POST(request) {",
    "  const helper = (row) => row;",
    '  return supabase.from("documents").select("*");',
    "}",
  ].join("\n");
  expect(
    analyzeFile("fixture-nested.ts", nestedLeak, ownerTables).length === 1,
    "nested helper / sibling handler must not mask an unscoped query",
  );

  // A non-owner-scoped table is not PHASE 1's concern — it has no owner_id column to filter
  // on. This is blind spot A, and it is closed by phase 2's derived-tier inventory, not by
  // widening this regex sweep. Do not "fix" this assertion; changing it would only make
  // phase 1 flag every join-through query with no way to describe why one is safe.
  const otherTable = `export async function GET() {
    const { data } = await supabase.from("document_chunks").select("*");
    return data;
  }`;
  expect(analyzeFile("fixture-other.ts", otherTable, ownerTables).length === 0, "non-owner table not flagged");

  // Schema parsing picks up owner_id tables and skips owner-less ones.
  const schema = `create table public.documents (\n  id uuid,\n  owner_id uuid\n);\ncreate table public.document_images (\n  id uuid,\n  document_id uuid\n);`;
  const parsed = ownerScopedTablesFromSchema(schema);
  expect(parsed.has("documents") && !parsed.has("document_images"), "schema parse: owner_id tables only");

  // Phase 2 sanity: the shared scanner must classify the three tiers and must not have been
  // reduced to a no-op. Its per-rule pass/fail fixtures live in
  // tests/retrieval-owner-filter-guard.test.ts, which drives the same exported functions.
  try {
    const scan = scanTenancy(process.cwd());
    expect(scan.counts.direct > 0, "phase 2: found no direct-tier queries");
    expect(scan.counts.userKeyed > 0, "phase 2: found no user-keyed queries");
    expect(scan.counts.derived > 0, "phase 2: found no derived-tier queries");
    expect(scan.tiers.derived.has("document_chunks"), "phase 2: document_chunks must be a derived-tier table");
    expect(!scan.tiers.direct.has("document_chunks"), "phase 2: document_chunks must not be a direct-tier table");
    expect(scanRpcDispatch(process.cwd()).dispatcherCallSites.length > 0, "phase 2: found no versioned-RPC call sites");
    // The anti-vacuous rule main() applies: an emptied tier (a database.types.ts reformat
    // defeats the indentation-anchored parse) must be reported, not exited 0 on.
    expect(emptyTierNames(scan.counts).length === 0, "phase 2: live scan has an empty tier");
    expect(
      emptyTierNames({ direct: 0, userKeyed: 0, derived: 0 }).length === 3,
      "phase 2: an empty scan must be reported as vacuous, not clean",
    );
  } catch (error) {
    failures.push(`phase 2 self-test threw: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (failures.length > 0) {
    console.error("✗ owner-scope guard self-test FAILED:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("✓ owner-scope guard self-test passed (phase 1 fixtures + phase 2 scanner sanity).");
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }
  const schemaText = readFileSync("supabase/schema.sql", "utf8");
  const files = readTrackedApiFiles();
  const { ownerTables, violations } = scanRepo({ schemaText, files });

  let failed = false;

  if (violations.length === 0) {
    console.log(
      `✓ owner-scope phase 1: ${files.length} src/app/api files clean against ${ownerTables.size} owner-scoped tables.`,
    );
  } else {
    failed = true;
    console.error(
      `✗ owner-scope phase 1: ${violations.length} query(ies) on owner-scoped tables lack an owner filter:\n`,
    );
    for (const v of violations) {
      console.error(
        `  ${v.file}:${v.line}  .from("${v.table}")  — no owner_id / withOwnerReadScope / owned-doc guard in this handler`,
      );
    }
    console.error(
      '\nScope the query (.eq("owner_id", …) or withOwnerReadScope/requireOwnedDocument), or, if ownership is enforced\n' +
        "indirectly and reviewed, add a documented entry to OWNER_SCOPE_ALLOWLIST in scripts/check-owner-scope-api.mjs.",
    );
  }

  // Phase 2: the shared mechanical scan (per-chain scope, three tiers, wider file set).
  const tenancy = scanTenancy(process.cwd());
  const rpc = scanRpcDispatch(process.cwd());

  // ANTI-VACUOUS: the tier derivation parses src/lib/supabase/database.types.ts with
  // indentation-anchored patterns, so a reformat of that generated file empties every tier —
  // and an empty tier set means zero sites, zero violations and a green exit. Without these
  // assertions the shipped gate could print "0 direct, 0 user-keyed and 0 derived-tier
  // queries" and pass. A scan that finds nothing is a broken scan, never a clean repo.
  const emptyTiers = emptyTierNames(tenancy.counts);
  const vacuous = emptyTiers.length > 0;
  if (vacuous) {
    failed = true;
    console.error(
      `\n✗ owner-scope phase 2: found NO ${emptyTiers.join(", ")} queries. The scan is vacuous — most likely the\n` +
        "  src/lib/supabase/database.types.ts tier parse stopped matching (its patterns are anchored to the\n" +
        "  generated file's exact indentation). Fix the parse; do not treat an empty scan as a clean repo.",
    );
  }

  if (!vacuous && tenancy.violations.length === 0 && rpc.violations.length === 0) {
    console.log(
      `✓ owner-scope phase 2: ${tenancy.counts.direct} direct, ${tenancy.counts.userKeyed} user-keyed, ` +
        `${tenancy.counts.derived} derived-tier and ${tenancy.counts.untiered} untiered-table queries scoped ` +
        `on their chain or declared; ${rpc.dispatcherCallSites.length} versioned-RPC call sites, all literal.`,
    );
  } else if (tenancy.violations.length > 0 || rpc.violations.length > 0) {
    failed = true;
    console.error(`\n✗ owner-scope phase 2: ${tenancy.violations.length + rpc.violations.length} finding(s):\n`);
    for (const v of [...tenancy.violations, ...rpc.violations]) console.error(`  ${v}\n`);
    console.error(
      "Put the tenancy predicate on the query's own chain, or add a reviewed entry to SCOPE_EXEMPTIONS /\n" +
        "DERIVED_QUERY_INVENTORY / UNTIERED_TABLE_DECLARATIONS in scripts/lib/tenancy-scan.mjs AND to the tables in\n" +
        "docs/audit/tenancy-defense-in-depth-review.md §6 (a committed test checks both).",
    );
  }

  process.exit(failed ? 1 : 0);
}

// Only run the scan when executed directly (not when imported by the test suite).
const invokedDirectly = (() => {
  try {
    return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) main();
