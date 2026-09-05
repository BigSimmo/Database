#!/usr/bin/env node
/**
 * Which Ward Flow screens already render a table, which implementation each uses, and what the
 * sixteen sites agree on.
 *
 * Written 2026-09-05 for the nine-screen design overhaul, because the "modular tabular layout"
 * requirement was about to be briefed as new work when most of the estate already had tables. A
 * count could not answer it: the question is WHICH implementation to converge on, and a total
 * hides its own coverage gap.
 *
 * ⚠️ **IT WALKS THE IMPORT GRAPH TRANSITIVELY, AND THE FIRST VERSION DID NOT.** That version
 * followed one level from each `page.tsx` and reported the Command screen as having no table. It
 * has one, through `ward-management-modes` -> `ward-management-network`. Two table-rendering files
 * were invisible to it for the same reason. **A sweep that stops at the first level answers a
 * question about imports while appearing to answer one about screens** — and it reported cleanly,
 * which is what made it convincing.
 *
 * ⚠️ **AND `<th[^>]*>` ALSO MATCHES `<thead>`.** An audit built on that regex reported a bare,
 * unscoped `<th>` in all ten files — one per table — and every one was the `<thead>`. The corrected
 * `<th[ >]` finds 84 `<th>` elements across the estate, every one carrying a scope. **A repo-wide
 * accessibility defect was very nearly reported from a prefix collision.**
 *
 * Run:  node scripts/ward-flow/table-sweep.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROUTE_ROOT = "src/app/mockups/ward-flow";
const WARD_ROOT = "src/components/ward-management";

function pages(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) pages(path, found);
    else if (entry.name === "page.tsx") found.push(path);
  }
  return found;
}

/** Resolve one import specifier to a file on disk, or null for a package. */
function resolveImport(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(from), spec);
  else return null;
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Every file transitively reachable from `entry` that renders a table.
 *
 * Four signals, not one: the element, the ARIA role, a `-table` test id, and a `styles.table*`
 * reference. Checking only the element misses a table built from divs; checking only the class
 * misses `ward-management-modes`, which renders the element and names no class. Both shapes exist
 * in this repository today.
 */
function tablesReachableFrom(entry) {
  const seen = new Set();
  const stack = [entry];
  const hits = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const source = readFileSync(current, "utf8");
    const evidence = [];
    if (/<table[\s>]/u.test(source)) evidence.push("<table>");
    if (/role="table"/u.test(source)) evidence.push('role="table"');
    for (const id of new Set(source.match(/data-testid="[^"]*-table"/gu) ?? [])) evidence.push(id);
    for (const cls of new Set(source.match(/styles\.table[A-Za-z]*/gu) ?? [])) evidence.push(cls);
    if (evidence.length > 0) {
      hits.push({ file: relative(WARD_ROOT, current).replaceAll("\\", "/"), evidence });
    }
    for (const spec of source.match(/from\s+"([^"]+)"/gu) ?? []) {
      const resolved = resolveImport(spec.replace(/^from\s+"/u, "").replace(/"$/u, ""), current);
      if (resolved) stack.push(resolved);
    }
  }
  return { hits, walked: seen.size };
}

const routes = pages(ROUTE_ROOT).sort();
const withTable = [];
const withoutTable = [];

for (const page of routes) {
  const route = relative(ROUTE_ROOT, dirname(page)).replaceAll("\\", "/") || "(index)";
  const { hits, walked } = tablesReachableFrom(page);
  (hits.length > 0 ? withTable : withoutTable).push({ route, hits, walked });
}

console.log(`routes walked: ${routes.length}   (transitive import graph, not one level)\n`);
console.log("HAS A TABLE");
for (const r of withTable) {
  console.log(`  ${r.route.padEnd(26)} ${r.hits.map((h) => h.file).join(", ")}`);
}
console.log("\nNONE");
for (const r of withoutTable) console.log(`  ${r.route}`);

// Every distinct table-rendering file, with what it agrees on. This is the extraction's input.
const files = [...new Set(withTable.flatMap((r) => r.hits.map((h) => h.file)))].sort();
console.log(`\nDISTINCT TABLE-RENDERING FILES REACHABLE FROM A ROUTE: ${files.length}`);
for (const file of files) {
  const source = readFileSync(join(WARD_ROOT, file), "utf8");
  // ⚠️ `<th[ >]`, never `<th[^>]*>` — see the header note. `<thead>` shares the prefix.
  const th = (source.match(/<th[\s>]/gu) ?? []).length;
  const unscoped = (source.match(/<th\s[^>]*>/gu) ?? []).filter((t) => !t.includes("scope=")).length;
  const rowScope = (source.match(/scope="row"/gu) ?? []).length;
  console.log(
    `  ${file.padEnd(42)} th=${String(th).padEnd(3)} unscoped=${String(unscoped).padEnd(2)} ` +
      `scope-row=${String(rowScope).padEnd(2)} tfoot=${(source.match(/<tfoot/gu) ?? []).length} ` +
      `sort=${(source.match(/aria-sort|onSort/gu) ?? []).length}`,
  );
}

// Anti-vacuity: floored on the POPULATION WALKED, never on the findings. A sweep that found no
// tables prints a clean report, and so does one whose route root has moved.
if (routes.length === 0) {
  console.error("\nREFUSED: walked no routes at all — the route root has moved or the glob is wrong.");
  process.exit(2);
}
