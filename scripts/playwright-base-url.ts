import { execFileSync } from "node:child_process";
import path from "node:path";
import { appName, localProjectId } from "./local-server-utils.mjs";

const projectRoot = path.resolve(__dirname, "..");
const ensureScript = path.join(projectRoot, "scripts", "ensure-local-server.mjs");
const localUrlPattern = /^http:\/\/localhost:\d+$/;
const identityScript = `
const http = require("node:http");
const url = process.argv[1] + "/api/local-project-id";
const request = http.get(url, { timeout: 1500 }, (response) => {
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

export function getPlaywrightBaseUrl() {
  const output = execFileSync(process.execPath, [ensureScript, "--print-url"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

  if (!localUrlPattern.test(output)) {
    throw new Error(`Expected ensure-local-server to print a localhost URL, received: ${output || "<empty>"}`);
  }

  verifyLocalProjectIdentity(output);
  return output;
}
