import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { appName, localProjectId, stableProjectPort } from "./local-server-utils.mjs";

const projectRoot = path.resolve(__dirname, "..");
const ensureScript = path.join(projectRoot, "scripts", "ensure-local-server.mjs");
const localUrlPattern = /^http:\/\/localhost:\d+$/;
const identityScript = `
const http = require("node:http");
const url = process.argv[1] + "/api/local-project-id";
const request = http.get(url, { timeout: 5000 }, (response) => {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => { body += chunk; });
  response.on("end", () => {
    if (response.statusCode !== 200) process.exit(2);
    process.stdout.write(body);
  });
});
request.on("timeout", () => { request.destroy(); process.exit(3); });
request.on("error", () => process.exit(4));
`;

function verifyLocalProjectIdentity(baseUrl: string) {
  const output = execFileSync(process.execPath, ["-e", identityScript, baseUrl], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  const payload = JSON.parse(output) as {
    appName?: string;
    projectId?: string;
    localServer?: { safeLocalOrigin?: boolean };
  };

  if (
    payload.appName !== appName ||
    payload.projectId !== localProjectId(projectRoot) ||
    payload.localServer?.safeLocalOrigin !== true
  ) {
    throw new Error(`Ensured URL failed /api/local-project-id guard: ${baseUrl}`);
  }
}

function tryVerifiedLocalProjectUrl(baseUrl: string) {
  try {
    verifyLocalProjectIdentity(baseUrl);
    return baseUrl;
  } catch {
    return null;
  }
}

function findExistingLocalProjectUrl() {
  const stablePort = stableProjectPort(projectRoot);
  return tryVerifiedLocalProjectUrl(`http://localhost:${stablePort}`);
}

export function getPlaywrightBaseUrl() {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  if (configuredBaseUrl) {
    if (!localUrlPattern.test(configuredBaseUrl)) {
      throw new Error(`PLAYWRIGHT_BASE_URL must be a localhost URL, received: ${configuredBaseUrl}`);
    }
    verifyLocalProjectIdentity(configuredBaseUrl);
    return configuredBaseUrl;
  }

  const existingUrl = findExistingLocalProjectUrl();
  if (existingUrl) return existingUrl;

  const result = spawnSync(process.execPath, [ensureScript, "--print-url"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = (result.stdout ?? "").trim();

  if (!localUrlPattern.test(output)) {
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const diagnostic = (result.stderr ?? "").trim();
      throw new Error(
        `ensure-local-server failed before printing a localhost URL${diagnostic ? `: ${diagnostic}` : "."}`,
      );
    }
    throw new Error(`Expected ensure-local-server to print a localhost URL, received: ${output || "<empty>"}`);
  }

  verifyLocalProjectIdentity(output);
  return output;
}
