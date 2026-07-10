import crypto from "node:crypto";

export const appName = "Clinical KB";
export const projectPortStart = 3100;
export const projectPortEnd = 4599;

export function normalizeProjectRoot(projectRoot) {
  return projectRoot.replaceAll("\\", "/").toLowerCase();
}

export function projectHash(projectRoot) {
  return crypto.createHash("sha256").update(normalizeProjectRoot(projectRoot)).digest();
}

export function stableProjectPort(projectRoot) {
  const offset = projectHash(projectRoot).readUInt32BE(0) % (projectPortEnd - projectPortStart + 1);
  return projectPortStart + offset;
}

export function localProjectId(projectRoot) {
  return `clinical-kb:${projectHash(projectRoot).toString("hex").slice(0, 12)}`;
}
