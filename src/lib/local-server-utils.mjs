import crypto from "node:crypto";
import path from "node:path";

export const appName = "PsychSift";
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

// Idle-shutdown minutes for a dev server run in the background (e.g. via
// `npm run ensure`), from DEV_SERVER_IDLE_MINUTES. Returns null when unset,
// non-numeric, zero, or negative — the caller's idle-shutdown watchdog stays
// disabled in that case.
export function parseIdleMinutes(rawValue) {
  const parsed = Number.parseFloat(rawValue ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// How to terminate the wrapped `next dev`/`next start` child once the idle
// watchdog fires. On POSIX, a plain SIGTERM is enough: next-dev's own CLI
// (node_modules/next/dist/cli/next-dev.js) installs a SIGTERM handler that
// forwards the signal to the actual server process it forks internally, and
// the caller's own SIGKILL fallback covers anything that doesn't exit cleanly.
// Windows has no such forwarding path: TerminateProcess-based termination
// (what Node's child.kill() maps every signal to on win32) tears down only
// the CLI process itself — no in-process handler ever runs to relay it to the
// forked grandchild server process, which then survives as an orphan bound to
// the port, defeating the point of the watchdog. `taskkill /T /F` terminates
// the whole process tree in one call instead, which is why Windows gets its
// own command here rather than reusing the POSIX signal path.
export function buildIdleShutdownCommand(pid, platform = process.platform) {
  if (platform === "win32") {
    return { kind: "taskkill", command: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
  }
  return { kind: "signal", signal: "SIGTERM" };
}
