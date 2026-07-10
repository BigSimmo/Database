import crypto from "node:crypto";

export const appName = "Clinical KB";
export const projectPortStart = 3100;
export const projectPortEnd = 4599;

// Ports Next.js refuses to bind ("Bad port: X is reserved for Y" — Chrome's
// restricted-port list). Worktree paths can hash onto one of these, which
// would make every dev/playwright server boot fail for that checkout.
const reservedDevPorts = new Set([3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);

export function isReservedDevPort(port) {
  return reservedDevPorts.has(port);
}

export function normalizeProjectRoot(projectRoot) {
  return projectRoot.replaceAll("\\", "/").toLowerCase();
}

export function projectHash(projectRoot) {
  return crypto.createHash("sha256").update(normalizeProjectRoot(projectRoot)).digest();
}

export function stableProjectPort(projectRoot) {
  const offset = projectHash(projectRoot).readUInt32BE(0) % (projectPortEnd - projectPortStart + 1);
  let port = projectPortStart + offset;
  while (isReservedDevPort(port)) {
    port = port >= projectPortEnd ? projectPortStart : port + 1;
  }
  return port;
}

export function localProjectId(projectRoot) {
  return `clinical-kb:${projectHash(projectRoot).toString("hex").slice(0, 12)}`;
}
