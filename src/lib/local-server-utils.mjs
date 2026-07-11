import crypto from "node:crypto";
import path from "node:path";

export const appName = "Clinical KB";
export const projectPortStart = 3100;
export const projectPortEnd = 4599;

export function normalizeProjectRoot(projectRoot, platform = process.platform) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolvedRoot = pathApi.resolve(projectRoot);
  return platform === "win32" ? resolvedRoot.replaceAll("\\", "/").toLowerCase() : resolvedRoot;
}

export function projectHash(projectRoot, platform = process.platform) {
  return crypto.createHash("sha256").update(normalizeProjectRoot(projectRoot, platform)).digest();
}

export function stableProjectPort(projectRoot, platform = process.platform) {
  const offset = projectHash(projectRoot, platform).readUInt32BE(0) % (projectPortEnd - projectPortStart + 1);
  return projectPortStart + offset;
}

export function localProjectId(projectRoot, platform = process.platform) {
  return `clinical-kb:${projectHash(projectRoot, platform).toString("hex").slice(0, 12)}`;
}
