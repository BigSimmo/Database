import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

export function vitestCacheDirectory(projectRoot, baseDirectory = os.tmpdir()) {
  const identity = path.resolve(projectRoot);
  const normalized = process.platform === "win32" ? identity.toLowerCase() : identity;
  const worktreeId = createHash("sha256").update(normalized).digest("hex").slice(0, 20);
  return path.join(baseDirectory, "clinical-kb-vitest-cache", worktreeId);
}
