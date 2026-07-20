#!/usr/bin/env node
// Gate-manifest self-test (maturity L3).
//
// Invariant: every static gate in the local `verify:cheap:internal` chain must
// also run in CI. Without this, a gate added to the local chain can be silently
// missed in `.github/workflows/ci.yml`, so a regression it would catch merges
// green because no workflow runs it. This has already happened twice — the
// `static-pr` job comment records type/icon/brand being promoted after that
// exact miss, and sitemap/therapy-data-index/design-system-contract were a
// second instance. This check makes the drift a hard CI failure instead.
//
// Direction is one-way on purpose: CI may run MORE than the local chain (e.g.
// `format:check`, or heavier build/e2e gates in other jobs). It must never run
// LESS of the local static set.
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const ci = readFileSync(".github/workflows/ci.yml", "utf8");

const localChain = pkg.scripts?.["verify:cheap:internal"] ?? "";
const localGates = [...localChain.matchAll(/npm run ([\w:.-]+)/g)].map((m) => m[1]);
if (localGates.length === 0) {
  console.error("gate-manifest: could not parse verify:cheap:internal from package.json.");
  process.exit(1);
}

// The `npm run <script>` invoked by a real YAML `run:` step, anchored to the
// field so a comment that merely mentions `run: npm run X` cannot masquerade as
// an executed gate (which would let the drift check pass after the real step was
// deleted). Trailing `# comment` on the step line is allowed. Steps in this repo
// are single-command, so a single capture is sufficient.
const npmRunScript = (line) => line.match(/^\s*(?:-\s*)?run:\s+npm run ([\w:.-]+)\s*(?:#.*)?$/)?.[1];

// Extract the `run: npm run X` scripts inside a named top-level job (2-space key).
function jobScripts(name) {
  const lines = ci.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start === -1) return null;
  const scripts = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  \S/.test(lines[i])) break; // reached the next top-level job
    const script = npmRunScript(lines[i]);
    if (script) scripts.push(script);
  }
  return scripts;
}

const staticPr = jobScripts("static-pr");
if (!staticPr) {
  console.error("gate-manifest: could not find the `static-pr` job in .github/workflows/ci.yml.");
  process.exit(1);
}

// Every `npm run X` anywhere in ci.yml — used to satisfy gates that run in CI
// under a different job/name than in the local chain.
const allCiScripts = new Set(ci.split(/\r?\n/).map(npmRunScript).filter(Boolean));

// A local gate whose CI counterpart has a different script name / job.
const CI_EQUIVALENT = new Map([
  // `npm run test` locally is the full vitest run; CI enforces it as coverage in
  // the dedicated `coverage` job, not in static-pr.
  ["test", "test:coverage"],
]);

// Local gates that deliberately do NOT run in CI. Empty today; kept as the
// explicit, reviewed escape hatch so any future exemption is a conscious edit.
const LOCAL_ONLY = new Set();

const failures = [];
for (const gate of localGates) {
  if (LOCAL_ONLY.has(gate)) continue;
  const equivalent = CI_EQUIVALENT.get(gate);
  if (equivalent) {
    if (!allCiScripts.has(equivalent)) {
      failures.push(`verify:cheap runs "${gate}" (CI counterpart "${equivalent}") but no CI job runs "${equivalent}".`);
    }
    continue;
  }
  if (!staticPr.includes(gate)) {
    failures.push(
      `verify:cheap runs "${gate}" but the static-pr CI job does not — add "- run: npm run ${gate}" to the static-pr job in .github/workflows/ci.yml, or record a mapping/exemption in scripts/check-gate-manifest.mjs.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Gate-manifest drift — a local verify:cheap gate is not enforced in CI:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Gate-manifest OK: all ${localGates.length} verify:cheap gates are enforced in CI (static-pr + mapped jobs).`,
);
