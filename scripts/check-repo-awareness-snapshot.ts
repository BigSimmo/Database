import { execFileSync } from "node:child_process";
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
 * `review_state` is also deliberately NOT compared in check gates. Review
 * records are dynamic and concurrent merges to `main` append new review records,
 * which would cause feature branch staleness check failures and merge conflicts.
 *
 * Excluding them fails safe: every deterministic content difference in routes,
 * documentation, and test health is still caught.
 */
const COMPARED_CONTENT_KEYS = ["routes", "documentation", "test_health"] as const;

export function isGitRepository(cwd = process.cwd()): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

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

export type CheckSnapshotOptions = {
  outputPath?: string;
  generateImpl?: () => RepoAwarenessSnapshot;
  readCommittedImpl?: (path: string) => unknown;
  isGitRepoImpl?: () => boolean;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
  exit?: (code: number) => void;
};

export function checkRepoAwarenessSnapshot(options: CheckSnapshotOptions = {}): number {
  const {
    outputPath = OUTPUT_PATH,
    generateImpl = generate,
    readCommittedImpl = (p) => JSON.parse(readFileSync(p, "utf8")),
    isGitRepoImpl = isGitRepository,
    log = console.log,
    error = console.error,
    exit = (code) => process.exit(code),
  } = options;

  if (!isGitRepoImpl()) {
    log(
      "[repo-awareness] Git repository not available (git-less environment); skipping repo-awareness snapshot staleness check.",
    );
    return 0;
  }

  let regenerated: RepoAwarenessSnapshot;
  try {
    regenerated = generateImpl();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("spawnSync git") ||
      message.includes("ENOENT") ||
      message.includes("not a git repository") ||
      message.includes("git: not found") ||
      message.includes("git is not available")
    ) {
      log(`[repo-awareness] skipped: git is not available in this environment (${message}).`);
      return 0;
    }
    error(`[repo-awareness] generation failed: ${message}`);
    exit(1);
    return 1;
  }

  let committed: unknown = null;
  try {
    committed = readCommittedImpl(outputPath);
  } catch {
    error(`[repo-awareness] ${outputPath} is missing or unreadable. Run: ${FIX}`);
    exit(1);
    return 1;
  }

  const differences = compareSnapshots(committed, regenerated);
  if (differences.length > 0) {
    error("[repo-awareness] The committed snapshot is behind the repository:");
    for (const difference of differences) error(`  - ${difference}`);
    error(`[repo-awareness] Fix with: ${FIX}`);
    exit(1);
    return 1;
  }

  log(
    `[repo-awareness] in step with ${outputPath} (${regenerated.routes.counts.pages} pages, ` +
      `${regenerated.documentation.counts.documents} documents, ${regenerated.review_state.counts.records} reviews)`,
  );
  return 0;
}

function main() {
  checkRepoAwarenessSnapshot();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
