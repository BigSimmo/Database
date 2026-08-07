#!/usr/bin/env node
/**
 * Fail closed when a designated container browser root cannot satisfy the
 * Playwright revision pinned by the installed playwright-core package (#255).
 *
 * Local managed caches (`~/.cache/ms-playwright`) are fine. The trap is
 * PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
 * where a newer lock expects chromium-1234 but the image only ships 1194 —
 * pointing PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH at the stale shell is forbidden.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CONTAINER_ROOT = "/opt/pw-browsers";

export function readExpectedChromiumRevision(projectRoot = process.cwd()) {
  const browsersJsonPath = path.join(projectRoot, "node_modules", "playwright-core", "browsers.json");
  if (!existsSync(browsersJsonPath)) {
    return { ok: false, reason: `playwright-core browsers.json missing at ${browsersJsonPath}` };
  }
  const payload = JSON.parse(readFileSync(browsersJsonPath, "utf8"));
  const chromium = (payload.browsers ?? []).find((entry) => entry.name === "chromium");
  if (!chromium?.revision) {
    return { ok: false, reason: "playwright-core browsers.json has no chromium.revision" };
  }
  return { ok: true, revision: String(chromium.revision), browsersJsonPath };
}

export function listInstalledChromiumRevisions(browsersRoot) {
  if (!browsersRoot || !existsSync(browsersRoot)) return [];
  const revisions = new Set();
  for (const entry of readdirSync(browsersRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const match = /^(?:chromium|chromium_headless_shell)-(\d+)$/.exec(entry.name);
    if (match) revisions.add(match[1]);
  }
  return [...revisions].sort();
}

/**
 * @param {{
 *   projectRoot?: string,
 *   env?: NodeJS.ProcessEnv,
 *   containerBrowsersRoot?: string,
 * }} [options]
 */
export function playwrightBrowserRevisionCheck(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const containerBrowsersRoot = options.containerBrowsersRoot ?? DEFAULT_CONTAINER_ROOT;
  const expected = readExpectedChromiumRevision(projectRoot);
  if (!expected.ok) {
    return {
      ok: false,
      status: "missing-playwright-core",
      message: expected.reason,
      expectedRevision: null,
      installedRevisions: [],
    };
  }

  const exposedRoot = env.PLAYWRIGHT_BROWSERS_PATH?.trim().replace(/\/+$/, "") ?? "";
  const downloadsDisabled = /^(?:1|true)$/i.test(env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD?.trim() ?? "");
  const designatedContainer =
    exposedRoot.replaceAll("\\", "/") === containerBrowsersRoot.replaceAll("\\", "/") && downloadsDisabled;

  if (!designatedContainer) {
    return {
      ok: true,
      status: "managed-or-unconstrained",
      message:
        "No designated container browser root is forced; use the Playwright-managed cache or install matching browsers.",
      expectedRevision: expected.revision,
      installedRevisions: [],
    };
  }

  const installed = listInstalledChromiumRevisions(exposedRoot);
  if (installed.includes(expected.revision)) {
    return {
      ok: true,
      status: "container-aligned",
      message: `Container browsers at ${exposedRoot} include chromium revision ${expected.revision}.`,
      expectedRevision: expected.revision,
      installedRevisions: installed,
    };
  }

  return {
    ok: false,
    status: "container-revision-drift",
    message: [
      `Playwright browser revision drift (#255): lock/playwright-core expects chromium-${expected.revision},`,
      `but ${exposedRoot} only has: ${installed.length ? installed.map((r) => `chromium-${r}`).join(", ") : "(none)"}.`,
      "Do not set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a mismatched shell.",
      "Delegate browser proof to CI Production UI, or refresh the image / run `npx playwright install` into a matching cache,",
      "or unset PLAYWRIGHT_BROWSERS_PATH and PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD so the managed cache can be used.",
    ].join(" "),
    expectedRevision: expected.revision,
    installedRevisions: installed,
  };
}

function parseArgs(args) {
  const options = { json: false, root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--root requires a project directory.");
      options.root = path.resolve(value);
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log("Usage: npm run check:playwright-browser-revision -- [--json] [--root directory]");
      process.exit(0);
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return options;
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const options = parseArgs(process.argv.slice(2));
  const result = playwrightBrowserRevisionCheck({ projectRoot: options.root });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`Playwright browser revision check OK (${result.status}): ${result.message}`);
  } else {
    console.error(result.message);
  }
  process.exit(result.ok ? 0 : 1);
}
