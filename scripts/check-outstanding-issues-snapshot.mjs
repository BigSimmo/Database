import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generate } from "./generate-outstanding-issues-snapshot.mjs";

const OUTPUT_PATH = "data/outstanding-issues-snapshot.json";
const FIX = "node scripts/generate-outstanding-issues-snapshot.mjs";

export function compareSnapshots(committed, regenerated) {
  const differences = [];
  if (committed?.version !== regenerated.version) {
    differences.push(`version: committed ${committed?.version} vs regenerated ${regenerated.version}`);
  }
  for (const key of Object.keys(regenerated.counts)) {
    if (committed?.counts?.[key] !== regenerated.counts[key]) {
      differences.push(
        `counts.${key}: committed ${committed?.counts?.[key]} vs regenerated ${regenerated.counts[key]}`,
      );
    }
  }
  for (const key of ["queue", "open", "pending", "ledger_revision"]) {
    if (JSON.stringify(committed?.[key]) !== JSON.stringify(regenerated[key])) {
      differences.push(`${key} differs from the ledger`);
    }
  }
  return differences;
}

function main() {
  const regenerated = generate();
  let committed = null;
  try {
    committed = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    console.error(`[snapshot] ${OUTPUT_PATH} is missing or unreadable. Run: ${FIX}`);
    process.exit(1);
  }
  const differences = compareSnapshots(committed, regenerated);
  if (differences.length > 0) {
    console.error("[snapshot] The committed snapshot is behind docs/outstanding-issues.md:");
    for (const difference of differences) console.error(`  - ${difference}`);
    console.error(`[snapshot] Fix with: ${FIX}`);
    process.exit(1);
  }
  console.log(
    `[snapshot] in step with ${OUTPUT_PATH} (${regenerated.counts.open} open, ${regenerated.counts.pending} pending)`,
  );
}

// Windows-safe main-module check — see generate-outstanding-issues-snapshot.mjs
// for why a manual `file://${argv[1]}` string reconstruction never matches
// `import.meta.url` on Windows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
