import { execFileSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const ensureScript = path.join(projectRoot, "scripts", "ensure-local-server.mjs");
const localUrlPattern = /^http:\/\/localhost:\d+$/;

export function getPlaywrightBaseUrl() {
  const output = execFileSync(process.execPath, [ensureScript, "--print-url"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

  if (!localUrlPattern.test(output)) {
    throw new Error(`Expected ensure-local-server to print a localhost URL, received: ${output || "<empty>"}`);
  }

  return output;
}
