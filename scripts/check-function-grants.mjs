#!/usr/bin/env node
// Guards the function-privilege convention against silent regressions.
//
// A SECURITY DEFINER function runs with its owner's privileges and bypasses RLS.
// If such a function in the `public` schema is executable by PUBLIC/anon, an
// unauthenticated caller can invoke it directly — e.g. a retrieval RPC that takes
// an `owner_filter` argument — and read across tenants. Postgres grants EXECUTE to
// PUBLIC by DEFAULT on every new function, so protection must be explicit. Today
// that protection is manual (a schema-wide blanket revoke plus per-function
// revokes), with nothing stopping a new SECURITY DEFINER RPC from shipping
// anon-callable. This check is that stop.
//
// Invariant enforced against the reconciled snapshot supabase/schema.sql:
//   Every SECURITY DEFINER function in `public` must be non-executable by PUBLIC —
//   i.e. either a schema-wide `revoke execute on all functions ... from public`
//   runs AFTER its definition, or it has its own `revoke execute on function
//   <name> ... from public`. Otherwise it is reported and CI fails.
//
// Scope note: SECURITY INVOKER functions run as the caller and stay bound by RLS,
// so they are out of scope here; this guard targets the escalation surface.
import { readFileSync } from "node:fs";

// Defaults to the committed snapshot; an explicit path is accepted for tests.
const SCHEMA_PATH = process.argv[2] ?? "supabase/schema.sql";

// SECURITY DEFINER functions intentionally left without a dedicated revoke.
// Add an entry ONLY with a concrete reason (prefer fixing over allowlisting).
const ALLOWLIST = new Map([
  // ["function_name", "why this is safe / follow-up ticket"],
]);

function main() {
  const sql = readFileSync(SCHEMA_PATH, "utf8");
  const lines = sql.split("\n");

  const blanketRe = /revoke\s+execute\s+on\s+all\s+functions\s+in\s+schema\s+public\s+from\s+[^;]*\bpublic\b/i;
  const blanketIdxs = [];
  lines.forEach((line, idx) => {
    if (blanketRe.test(line)) blanketIdxs.push(idx);
  });

  if (blanketIdxs.length === 0) {
    console.error(
      `check:function-grants: FAIL — no schema-wide "revoke execute on all functions in schema public from ... public" ` +
        `statement found in ${SCHEMA_PATH}. That baseline revoke is what strips the default anon EXECUTE grant; its ` +
        `removal is itself the regression this guard exists to catch.`,
    );
    process.exit(1);
  }

  // A blanket revoke only affects functions that already exist when it runs, so a
  // function is "covered" only if a blanket revoke appears AFTER its definition.
  const coveredByBlanket = (createIdx) => blanketIdxs.some((b) => b > createIdx);

  // Collect every public-function CREATE site. CREATE OR REPLACE preserves prior
  // grants, so group by name and use the EARLIEST definition to decide coverage.
  const createRe = /^\s*create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(/i;
  const creates = [];
  lines.forEach((line, idx) => {
    const m = createRe.exec(line);
    if (m) creates.push({ name: m[1].toLowerCase(), idx });
  });

  const byName = new Map(); // name -> { earliestIdx, isDefiner }
  creates.forEach((current, i) => {
    const end = i + 1 < creates.length ? creates[i + 1].idx : lines.length;
    const body = lines.slice(current.idx, end).join("\n");
    const isDefiner = /security\s+definer/i.test(body);
    const prior = byName.get(current.name);
    if (!prior) {
      byName.set(current.name, { earliestIdx: current.idx, isDefiner });
    } else {
      byName.set(current.name, {
        earliestIdx: Math.min(prior.earliestIdx, current.idx),
        isDefiner: prior.isDefiner || isDefiner,
      });
    }
  });

  // Names with an explicit per-function execute revoke anywhere in the file.
  // Accepts both `revoke execute on function` and `revoke all [privileges] on
  // function` (both strip the default PUBLIC EXECUTE; the schema uses each form).
  // Lenient name-level match (ignores the exact argument signature) so a correctly
  // revoked function never trips the guard.
  const revokeRe = /revoke\s+(?:execute|all(?:\s+privileges)?)\s+on\s+function\s+(?:public\.)?"?([a-z0-9_]+)"?/gi;
  const revoked = new Set();
  let rm;
  while ((rm = revokeRe.exec(sql))) revoked.add(rm[1].toLowerCase());

  let definerCount = 0;
  const vulnerable = [];
  for (const [name, info] of byName) {
    if (!info.isDefiner) continue;
    definerCount += 1;
    if (coveredByBlanket(info.earliestIdx)) continue;
    if (revoked.has(name)) continue;
    if (ALLOWLIST.has(name)) continue;
    vulnerable.push({ name, idx: info.earliestIdx });
  }

  if (vulnerable.length > 0) {
    vulnerable.sort((a, b) => a.idx - b.idx);
    console.error(
      `check:function-grants: FAIL — ${vulnerable.length} SECURITY DEFINER function(s) in ${SCHEMA_PATH} are executable ` +
        `by PUBLIC/anon (defined after the last blanket revoke with no explicit per-function revoke):\n` +
        vulnerable.map((v) => `  - public.${v.name}  (schema.sql:${v.idx + 1})`).join("\n") +
        `\n\nFix: add \`revoke execute on function public.<name>(<args>) from public, anon, authenticated;\` (and grant ` +
        `execute only to the intended role, e.g. service_role) in the migration that defines it, then reconcile ` +
        `schema.sql. If genuinely safe, allowlist it with a reason in scripts/check-function-grants.mjs.`,
    );
    process.exit(1);
  }

  console.log(
    `check:function-grants: OK — all ${definerCount} SECURITY DEFINER public function(s) are revoked from PUBLIC ` +
      `(blanket revoke at schema.sql:${Math.max(...blanketIdxs) + 1} or an explicit per-function revoke).`,
  );
}

main();
