import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args: string[]) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function trackedPaths(pathspec: string) {
  return git(["ls-files", "--", pathspec]).split(/\r?\n/).filter(Boolean);
}

/** `--no-index` makes check-ignore report the rule even for a path git already tracks. */
function isIgnored(repoRelative: string) {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", "--", repoRelative], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

// A path cannot be tracked, ignored and targeted for deletion at once: the tracked copy
// vanishes from the tree on the next clean, and re-adding it needs `git add -f`.
describe("tracked repository files are never ignored artifacts", () => {
  it("keeps the committed staging tenancy evidence document out of the artifact ignore rule", () => {
    const tracked = trackedPaths("docs/archive/staging-tenancy-evidence-*");
    expect(tracked.length, "the evidence document is a tracked repository file").toBeGreaterThan(0);
    for (const file of tracked) {
      expect(isIgnored(file), `${file} is tracked and must not be ignored`).toBe(false);
    }
    // Downloaded CI artifacts with the same prefix stay ignored.
    expect(isIgnored("docs/archive/staging-tenancy-evidence-00000000000/staging-tenancy-evidence.json")).toBe(true);
  });

  it("does not track the Supabase CLI's per-machine branch state and ignores it", () => {
    expect(trackedPaths("supabase/.branches")).toEqual([]);
    expect(isIgnored("supabase/.branches/_current_branch")).toBe(true);
    expect(isIgnored("supabase/.temp/cli-latest")).toBe(true);
  });
});
