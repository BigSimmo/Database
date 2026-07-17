import crypto from "node:crypto";
import path from "node:path";

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
  let port = projectPortStart + offset;
  while (isReservedDevPort(port)) {
    port = port >= projectPortEnd ? projectPortStart : port + 1;
  }
  return port;
}

export function circularProjectPortRange(startPort) {
  if (!Number.isInteger(startPort) || startPort < projectPortStart || startPort > projectPortEnd) {
    throw new Error(`Project port must be between ${projectPortStart} and ${projectPortEnd}: ${startPort}`);
  }
  const count = projectPortEnd - projectPortStart + 1;
  return Array.from(
    { length: count },
    (_, index) => projectPortStart + ((startPort - projectPortStart + index) % count),
  );
}

export function localProjectId(projectRoot, platform = process.platform) {
  return `clinical-kb:${projectHash(projectRoot, platform).toString("hex").slice(0, 12)}`;
}
