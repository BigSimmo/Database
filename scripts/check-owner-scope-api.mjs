#!/usr/bin/env node
// Defense-in-depth tenancy guard (audit finding D2 / M6).
//
// The app is a deliberately single-layer tenancy design: every API route uses the
// service-role Supabase client (RLS bypassed) and enforces ownership in application
// code via an `owner_id` filter. `docs/tenancy-defense-in-depth-review.md` verified
// 0/33 route gaps, but flagged (§6 item 2) that a *future* handler dropping the owner
// filter is the single regression class this design is exposed to.
//
// This guard closes that class statically: it fails when a `src/app/api/**` handler
// queries an OWNER-SCOPED table (any table with an `owner_id` column in
// supabase/schema.sql) without a recognised owner-scoping construct in the enclosing
// handler — `.eq("owner_id"...)`, `withOwnerReadScope`, `requireOwnerScope`,
// `requireOwnedDocument`/`loadOwnedDocument`/`ownedDocumentId`, a `documents!inner`
// + `documents.owner_id` join, or an `owner_id:` write payload. Intentional
// exceptions (indirect scoping the reviewer confirmed safe) live in
// OWNER_SCOPE_ALLOWLIST with a reason.
//
// Usage:
//   node scripts/check-owner-scope-api.mjs             scan the repo; exit 1 on any violation
//   node scripts/check-owner-scope-api.mjs --self-test run the synthetic pass/fail fixtures

import { readFileSync, realpathSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
// docs/tenancy-defense-in-depth-review.md. Keep this list empty unless a real, reviewed
// indirect-scope pattern exists — a forgotten filter must NOT be silenced here.
export const OWNER_SCOPE_ALLOWLIST = [
  {
    file: "src/app/api/setup-status/route.ts",
    table: "documents",
    reason:
      "Global setup/health diagnostic: a `.limit(1)` existence probe (is any document indexed?), not an owner-data read. The route is gated to local origin and returns only status booleans — see docs/tenancy-defense-in-depth-review.md §3 (setup-status row / TEN-N1).",
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "import_batches",
    reason:
      "Global setup/health diagnostic: a `.limit(1)` existence probe for schema provisioning, not an owner-data read. Same local-origin-gated status route — see docs/tenancy-defense-in-depth-review.md §3 (TEN-N1).",
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
 * Split source into top-level handler/function segments so a `.from(...)` can be checked
 * against only its enclosing handler's text. Boundaries are function-start lines; this
 * intentionally avoids brace matching (robust to strings/comments) at the cost of a segment
 * possibly trailing into the next function — harmless for presence-of-token detection.
 */
const HANDLER_START = /^\s*export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;

function functionSegments(text) {
  const lines = text.split("\n");
  const START =
    /^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(export\s+)?const\s+\w+\s*=\s*(async\s*)?(\([^)]*\)|\w+)\s*(:[^=]+)?=>/;
  const starts = [];
  lines.forEach((line, i) => {
    if (START.test(line)) starts.push(i);
  });
  if (starts.length === 0) return [{ startLine: 0, text, isHandler: false }];
  const segments = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    segments.push({
      startLine: from,
      text: lines.slice(from, to).join("\n"),
      isHandler: HANDLER_START.test(lines[from]),
    });
  }
  // Anything before the first function (imports/consts) — its own segment.
  if (starts[0] > 0) segments.unshift({ startLine: 0, text: lines.slice(0, starts[0]).join("\n"), isHandler: false });
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
    // Route handlers are checked strictly against their own body. Queries inside
    // in-file helpers (or top-level) fall back to the whole file, because their
    // ownership is enforced by the handler(s) that call them within the same file.
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
  const listed = execSync("git ls-files src/app/api", { encoding: "utf8" })
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

  // A non-owner-scoped table is not the guard's concern.
  const otherTable = `export async function GET() {
    const { data } = await supabase.from("document_chunks").select("*");
    return data;
  }`;
  expect(analyzeFile("fixture-other.ts", otherTable, ownerTables).length === 0, "non-owner table not flagged");

  // Schema parsing picks up owner_id tables and skips owner-less ones.
  const schema = `create table public.documents (\n  id uuid,\n  owner_id uuid\n);\ncreate table public.document_images (\n  id uuid,\n  document_id uuid\n);`;
  const parsed = ownerScopedTablesFromSchema(schema);
  expect(parsed.has("documents") && !parsed.has("document_images"), "schema parse: owner_id tables only");

  if (failures.length > 0) {
    console.error("✗ owner-scope guard self-test FAILED:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("✓ owner-scope guard self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }
  const schemaText = readFileSync("supabase/schema.sql", "utf8");
  const files = readTrackedApiFiles();
  const { ownerTables, violations } = scanRepo({ schemaText, files });

  if (violations.length === 0) {
    console.log(
      `✓ owner-scope: ${files.length} src/app/api files clean against ${ownerTables.size} owner-scoped tables.`,
    );
    process.exit(0);
  }

  console.error(`✗ owner-scope: ${violations.length} query(ies) on owner-scoped tables lack an owner filter:\n`);
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}  .from("${v.table}")  — no owner_id / withOwnerReadScope / owned-doc guard in this handler`,
    );
  }
  console.error(
    '\nScope the query (.eq("owner_id", …) or withOwnerReadScope/requireOwnedDocument), or, if ownership is enforced\n' +
      "indirectly and reviewed, add a documented entry to OWNER_SCOPE_ALLOWLIST in scripts/check-owner-scope-api.mjs.",
  );
  process.exit(1);
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
