#!/usr/bin/env node

import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireMatch(errors, value, pattern, message) {
  if (!pattern.test(value)) errors.push(message);
}

export function validateCodexCloudSetup() {
  const errors = [];
  const packageJson = JSON.parse(read("package.json"));
  const nodeVersion = read(".node-version").trim();
  const nvmVersion = read(".nvmrc").trim();
  const setup = read("scripts/setup-codex-cloud.sh");
  const maintenance = read("scripts/maintain-codex-cloud.sh");
  const guide = read("docs/codex-cloud.md");
  const agents = read("AGENTS.md");

  if (packageJson.engines?.node !== `${nodeVersion}.x`) {
    errors.push(`package.json engines.node must match .node-version (${nodeVersion}.x).`);
  }
  if (packageJson.engines?.npm !== "11.x") errors.push("package.json must require npm 11.x.");
  if (!String(packageJson.packageManager ?? "").startsWith("npm@11.")) {
    errors.push("package.json packageManager must pin npm 11.x.");
  }
  if (nvmVersion !== nodeVersion) errors.push(".nvmrc and .node-version must match.");

  requireMatch(
    errors,
    setup,
    /npm ci --include=dev/,
    "Cloud setup must install the exact lockfile with dev dependencies.",
  );
  requireMatch(errors, setup, /npm run check:runtime/, "Cloud setup must verify the Node and npm runtime.");
  requireMatch(errors, setup, /npm run check:installed-lock-parity/, "Cloud setup must verify installed-lock parity.");
  requireMatch(errors, setup, /deno@2/, "Cloud setup must install Deno 2.x when needed.");
  requireMatch(
    errors,
    setup,
    /worker\/python\/requirements\.txt/,
    "Cloud setup must install the Python worker requirements.",
  );
  requireMatch(
    errors,
    setup,
    /playwright install --with-deps chromium firefox webkit/,
    "Cloud setup must install the Playwright browser matrix.",
  );
  requireMatch(errors, setup, /RAG_PROVIDER_MODE=offline/, "Cloud setup must default RAG to provider-free mode.");
  requireMatch(errors, setup, /unset OPENAI_API_KEY/, "Cloud setup must remove OpenAI credentials from agent shells.");
  requireMatch(
    errors,
    setup,
    /unset GH_TOKEN GITHUB_TOKEN/,
    "Cloud setup must not expose GitHub tokens to agent shells.",
  );
  requireMatch(errors, maintenance, /check:installed-lock-parity/, "Cloud maintenance must detect dependency drift.");
  requireMatch(
    errors,
    setup,
    /check:codex-cloud -- --runtime/,
    "Cloud setup must run the live Cloud runtime acceptance check.",
  );
  requireMatch(
    errors,
    maintenance,
    /check:codex-cloud -- --runtime/,
    "Cloud maintenance must run the live Cloud runtime acceptance check.",
  );
  requireMatch(errors, guide, /bash scripts\/setup-codex-cloud\.sh/, "The Cloud guide must provide the setup command.");
  requireMatch(
    errors,
    guide,
    /bash scripts\/maintain-codex-cloud\.sh/,
    "The Cloud guide must provide the maintenance command.",
  );
  for (const value of [
    "CODEX_CLOUD=1",
    "RAG_PROVIDER_MODE=offline",
    "NEXT_PUBLIC_DEMO_MODE=true",
    "PLAYWRIGHT_OFFLINE_MODE=true",
  ]) {
    if (!guide.includes(value)) errors.push(`The Cloud guide must document ${value}.`);
  }
  requireMatch(
    errors,
    guide,
    /GitHub connector permission is separate from credentials inside the agent shell/,
    "The Cloud guide must distinguish GitHub connector permission from shell credentials.",
  );

  const forbiddenProviderCommands = [
    "check:supabase-project",
    "test:live",
    "eval:rag",
    "eval:quality",
    "eval:retrieval",
    "verify:release",
  ];
  for (const command of forbiddenProviderCommands) {
    if (setup.includes(command) || maintenance.includes(command)) {
      errors.push(`Cloud bootstrap scripts must not invoke provider-capable command ${command}.`);
    }
  }

  const liveIdentifiers = [
    /sjrfecxgysukkwxsowpy/i,
    /5deaad0b-675a-4c13-978e-5ca2b5b877f9/i,
    /sk-[A-Za-z0-9_-]{12,}/,
    /sb_secret_[A-Za-z0-9_-]{8,}/,
  ];
  for (const pattern of liveIdentifiers) {
    if (pattern.test(setup) || pattern.test(maintenance)) {
      errors.push(`Cloud bootstrap scripts contain a live provider identifier matching ${pattern}.`);
    }
  }

  const cloudHeadingCount = (agents.match(/^## Codex Cloud environment$/gm) ?? []).length;
  if (cloudHeadingCount !== 1) {
    errors.push(`AGENTS.md must contain exactly one Codex Cloud environment section; found ${cloudHeadingCount}.`);
  }

  return errors;
}

function commandVersion(command, args, expectedPattern) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0 || !expectedPattern.test(output)) {
    return `${command} ${args.join(" ")} failed its runtime check (${output || `exit ${result.status}`}).`;
  }
  return null;
}

export async function validateCodexCloudRuntime() {
  const errors = [];
  const expectedEnvironment = {
    CODEX_CLOUD: "1",
    RAG_PROVIDER_MODE: "offline",
    NEXT_PUBLIC_DEMO_MODE: "true",
    PLAYWRIGHT_OFFLINE_MODE: "true",
  };
  for (const [name, expected] of Object.entries(expectedEnvironment)) {
    if (process.env[name] !== expected) {
      errors.push(`${name} must be ${expected} in the Cloud agent shell.`);
    }
  }

  const denoError = commandVersion("deno", ["--version"], /^deno 2\./m);
  if (denoError) errors.push(denoError);

  const python3Error = commandVersion("python3", ["--version"], /^Python 3\./m);
  const pythonError = python3Error ? commandVersion("python", ["--version"], /^Python 3\./m) : null;
  if (python3Error && pythonError) errors.push("Python 3 is unavailable in the Cloud runtime.");

  const tesseractError = commandVersion("tesseract", ["--version"], /^tesseract 5\./m);
  if (tesseractError) errors.push(tesseractError);

  if (process.env.CODEX_CLOUD_SKIP_BROWSER_INSTALL !== "1") {
    try {
      const { chromium, firefox, webkit } = await import("playwright");
      for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
        const executablePath = browserType.executablePath();
        const stats = statSync(executablePath);
        accessSync(executablePath, constants.X_OK);
        if (!stats.isFile()) errors.push(`${name} executable path is not a file: ${executablePath}`);
      }
    } catch (error) {
      errors.push(`Playwright browser executable validation failed: ${error.message}`);
    }
  }

  return errors;
}

const errors = validateCodexCloudSetup();
if (process.argv.includes("--runtime")) {
  errors.push(...(await validateCodexCloudRuntime()));
}
if (errors.length > 0) {
  for (const error of errors) console.error(`[Codex Cloud Check] FAIL: ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    "[Codex Cloud Check] PASS: runtime, setup, maintenance, offline safety, and documentation contracts match.",
  );
}
