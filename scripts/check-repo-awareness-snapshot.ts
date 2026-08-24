import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import type { RepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-types";

import { generate, OUTPUT_PATH } from "./generate-repo-awareness-snapshot";

const FIX = "npm run snapshot:repo-awareness";

/**
 * Content keys only.
 *
 * `captured_revision` is deliberately NOT compared. It is the sha of the last
 * commit touching this snapshot's inputs, so it changes as a *side effect* of
 * committing the snapshot: regenerate, commit, and that commit becomes the
 * newest change to `docs/` — so the next regeneration yields a different sha
 * with nothing stale. The gate would then fail on every docs change, and `main`
 * would go red after each squash merge that touched a document.
 *
 * Excluding it fails safe: a lagging revision can only make a page report
 * itself as OLDER than it is, and every content difference is still caught.
 */
const COMPARED_CONTENT_KEYS = ["routes", "documentation", "test_health", "review_state"] as const;

export function compareSnapshots(committed: unknown, regenerated: RepoAwarenessSnapshot): string[] {
  const differences: string[] = [];
  const record =
    committed !== null && typeof committed === "object" && !Array.isArray(committed)
      ? (committed as Partial<RepoAwarenessSnapshot> & Record<string, unknown>)
      : {};

  if (record.version !== regenerated.version) {
    differences.push(`version: committed ${String(record.version)} vs regenerated ${regenerated.version}`);
  }

  for (const key of COMPARED_CONTENT_KEYS) {
    if (JSON.stringify(record[key]) !== JSON.stringify(regenerated[key])) {
      differences.push(`${key} differs from the repository`);
    }
  }

  // The union of both key sets, so a committed snapshot carrying a key the
  // generator no longer emits is caught rather than silently ignored.
  const topLevelKeys = new Set([...Object.keys(regenerated), ...Object.keys(record)]);
  for (const key of topLevelKeys) {
    if (!(key in regenerated)) differences.push(`unexpected key in the committed snapshot: ${key}`);
    else if (!(key in record)) differences.push(`missing key in the committed snapshot: ${key}`);
  }

  return differences;
}

function main() {
  const regenerated = generate();
  let committed: unknown = null;
  try {
    committed = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    console.error(`[repo-awareness] ${OUTPUT_PATH} is missing or unreadable. Run: ${FIX}`);
    process.exit(1);
  }
  const differences = compareSnapshots(committed, regenerated);
  if (differences.length > 0) {
    console.error("[repo-awareness] The committed snapshot is behind the repository:");
    for (const difference of differences) console.error(`  - ${difference}`);
    console.error(`[repo-awareness] Fix with: ${FIX}`);
    process.exit(1);
  }
  console.log(
    `[repo-awareness] in step with ${OUTPUT_PATH} (${regenerated.routes.counts.pages} pages, ` +
      `${regenerated.documentation.counts.documents} documents, ${regenerated.review_state.counts.records} reviews)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
