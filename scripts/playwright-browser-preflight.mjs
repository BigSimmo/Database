#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

const BROWSER_TYPES = {
  chromium,
  firefox,
  webkit,
};

/**
 * Derive the default headless-shell binary Playwright launches for Chromium
 * tests. `chromium.executablePath()` points at full Chrome for Testing; the
 * default headless project uses chrome-headless-shell instead.
 */
export function defaultChromiumHeadlessShellPath(chromeExecutablePath = chromium.executablePath()) {
  const normalized = chromeExecutablePath.replaceAll("\\", "/");
  const match = normalized.match(/^(.*)\/chromium-(\d+)\/chrome-([^/]+)\/chrome(?:\.exe)?$/i);
  if (!match) return chromeExecutablePath;
  const [, browsersRoot, revision, platform] = match;
  const binary = process.platform === "win32" ? "chrome-headless-shell.exe" : "chrome-headless-shell";
  return path.join(browsersRoot, `chromium_headless_shell-${revision}`, `chrome-headless-shell-${platform}`, binary);
}

export function requestedPlaywrightBrowserProjects(args = []) {
  const projects = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--project" && args[index + 1]) {
      projects.add(args[index + 1]);
      index += 1;
      continue;
    }
    if (token.startsWith("--project=")) projects.add(token.slice("--project=".length));
  }
  if (projects.size === 0) return ["chromium"];
  return [...projects];
}

function browserFamilyForProject(project) {
  if (project === "firefox") return "firefox";
  if (project === "webkit") return "webkit";
  // chromium, chromium-mockups, and any other Chromium-based project.
  return "chromium";
}

export function resolvePlaywrightBrowserExecutable(family, env = process.env) {
  if (family === "chromium") {
    const override = env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
    if (override) {
      return {
        family,
        path: override,
        source: "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
      };
    }
    return {
      family,
      path: defaultChromiumHeadlessShellPath(),
      source: "playwright chromium-headless-shell",
    };
  }
  return {
    family,
    path: BROWSER_TYPES[family].executablePath(),
    source: `playwright ${family}`,
  };
}

export function playwrightBrowserPreflight(args = [], env = process.env) {
  const projects = requestedPlaywrightBrowserProjects(args);
  const families = [...new Set(projects.map(browserFamilyForProject))];
  const missing = [];
  for (const family of families) {
    const resolved = resolvePlaywrightBrowserExecutable(family, env);
    if (!existsSync(resolved.path)) missing.push(resolved);
  }
  if (missing.length === 0) {
    return { ok: true, projects, checked: families.map((family) => resolvePlaywrightBrowserExecutable(family, env)) };
  }
  const details = missing.map((entry) => `- ${entry.family} (${entry.source}): ${entry.path}`).join("\n");
  return {
    ok: false,
    projects,
    missing,
    message:
      `Playwright browser preflight failed before the production build.\n` +
      `Missing executable(s):\n${details}\n` +
      `Install matching browsers with \`npx playwright install\`, or set ` +
      `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a launchable Chromium binary. ` +
      `Do not treat a later "N failed" summary as a product regression when the browser binary is absent.`,
  };
}

export function assertPlaywrightBrowsersReady(args = [], env = process.env, { stderr = console.error } = {}) {
  const result = playwrightBrowserPreflight(args, env);
  if (result.ok) return result;
  stderr(result.message);
  process.exit(1);
}
