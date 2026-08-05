import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

function worktreeCacheId(projectRoot) {
  const identity = path.resolve(projectRoot);
  const normalized = process.platform === "win32" ? identity.toLowerCase() : identity;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 20);
}

export function vitestCacheDirectory(projectRoot, baseDirectory = os.tmpdir()) {
  return path.join(baseDirectory, "clinical-kb-vitest-cache", worktreeCacheId(projectRoot));
}

/**
 * Per-worktree TypeScript incremental cache path.
 *
 * @param {string} projectRoot
 * @param {string} [baseDirectory]
 * @param {string} [fileName] Distinct filename when two configs share a worktree
 *   cache directory (e.g. base vs source-only typecheck).
 */
export function typescriptBuildInfoPath(projectRoot, baseDirectory = os.tmpdir(), fileName = "tsconfig.tsbuildinfo") {
  return path.join(baseDirectory, "clinical-kb-tsc-cache", worktreeCacheId(projectRoot), fileName);
}
