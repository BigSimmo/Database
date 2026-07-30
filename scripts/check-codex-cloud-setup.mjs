#!/usr/bin/env node

import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const providerCredentialVariables = [
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "RAILWAY_API_TOKEN",
  "RAILWAY_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "GLAB_TOKEN",
  "CODEX_TRIGGER_TOKEN",
  "HEALTH_DEEP_PROBE_SECRET",
  "INDEXING_V3_AGENT_SECRET",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
];

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireMatch(errors, value, pattern, message) {
  if (!pattern.test(value)) errors.push(message);
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function obsoleteNpmProxyVariables(env = process.env) {
  return ["npm_config_http_proxy", "npm_config_https_proxy", "npm_config_proxy"].filter(
    (name) => Object.hasOwn(env, name) && Boolean(env[name]),
  );
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function configuredProviderCredentialNames(env = process.env) {
  return providerCredentialVariables.filter((name) => Object.hasOwn(env, name) && Boolean(env[name]));
}

export function localGitBaseline(root = process.cwd()) {
  for (const ref of ["refs/remotes/origin/main", "refs/heads/main"]) {
    const result = spawnSync("git", ["show-ref", "--verify", "--quiet", ref], {
      cwd: root,
      stdio: "ignore",
    });
    if (result.status === 0) return ref;
  }
  return null;
}

export function executableFile(filePath) {
  try {
    return statSync(filePath).isFile() && (accessSync(filePath, constants.X_OK), true);
  } catch {
    return false;
  }
}

export const pythonWorkerImports = ["fitz", "PIL", "pytesseract", "medspacy"];

/**
 * @param {string} pythonCommand
 * @param {(
 *   command: string,
 *   args: string[],
 *   options?: { encoding?: BufferEncoding; shell?: boolean },
 * ) => { status: number | null }} [run]
 * @returns {string | null}
 */
export function pythonWorkerImportError(pythonCommand, run = spawnSync) {
  if (!pythonCommand || !executableFile(pythonCommand)) {
    return "The configured Codex Cloud OCR Python executable is unavailable.";
  }
  const result = run(pythonCommand, ["-c", `import ${pythonWorkerImports.join(", ")}`], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status === 0) return null;
  return `Python worker imports failed: ${pythonWorkerImports.join(", ")}.`;
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
  const envExample = read(".env.example");
  const gitignore = read(".gitignore");

  if (packageJson.engines?.node !== `${nodeVersion}.x`) {
    errors.push(`package.json engines.node must match .node-version (${nodeVersion}.x).`);
  }
  if (packageJson.engines?.npm !== "11.x") errors.push("package.json must require npm 11.x.");
  if (!String(packageJson.packageManager ?? "").startsWith("npm@11.")) {
    errors.push("package.json packageManager must pin npm 11.x.");
  }
  if (nvmVersion !== nodeVersion) errors.push(".nvmrc and .node-version must match.");
  requireMatch(errors, gitignore, /^\/error\.log$/m, "Codex Cloud diagnostic error.log must stay ignored.");

  for (const [pattern, message] of [
    [/npm ci --include=dev/, "Cloud setup must install the exact lockfile with dev dependencies."],
    [/deno@2/, "Cloud setup must install Deno 2.x."],
    [/worker\/python\/requirements\.txt/, "Cloud setup must install Python worker requirements."],
    [/CODEX_CLOUD_OCR_PYTHON/, "Cloud setup must expose the Python worker environment."],
    [/playwright install --with-deps chromium firefox webkit/, "Cloud setup must install every browser."],
    [/CODEX_CLOUD_ACCESS_PROFILE/, "Cloud setup must support explicit access profiles."],
    [/RAG_PROVIDER_MODE=offline/, "Cloud setup must default RAG to offline mode."],
    [/unset OPENAI_API_KEY/, "Cloud setup must remove provider credentials in offline mode."],
    [/check:codex-cloud -- --runtime/, "Cloud setup must run runtime acceptance."],
  ]) {
    requireMatch(errors, setup, pattern, message);
  }
  for (const name of providerCredentialVariables) {
    if (!setup.includes(name)) errors.push(`Cloud offline setup must handle ${name}.`);
  }
  const credentialLikeExampleNames = [
    ...envExample.matchAll(/^([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|DB_URL))=/gm),
  ].map(([, name]) => name);
  for (const name of credentialLikeExampleNames) {
    if (!providerCredentialVariables.includes(name)) {
      errors.push(`Cloud credential inventory must include .env.example variable ${name}.`);
    }
  }
  requireMatch(
    errors,
    maintenance,
    /exec bash scripts\/setup-codex-cloud\.sh/,
    "Maintenance must repair the full toolchain.",
  );
  requireMatch(errors, guide, /bash scripts\/setup-codex-cloud\.sh/, "The guide must provide the setup command.");
  requireMatch(errors, guide, /CODEX_CLOUD_ACCESS_PROFILE=connected/, "The guide must document connected access.");
  requireMatch(errors, guide, /GitHub connector/, "The guide must document GitHub connector access.");

  for (const command of [
    "check:supabase-project",
    "test:live",
    "eval:rag",
    "eval:quality",
    "eval:retrieval",
    "verify:release",
  ]) {
    if (setup.includes(command) || maintenance.includes(command)) {
      errors.push(`Cloud bootstrap scripts must not invoke provider-capable command ${command}.`);
    }
  }

  for (const pattern of [
    /sjrfecxgysukkwxsowpy/i,
    /5deaad0b-675a-4c13-978e-5ca2b5b877f9/i,
    /sk-[A-Za-z0-9_-]{12,}/,
    /sb_secret_[A-Za-z0-9_-]{8,}/,
  ]) {
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
    return `${command} ${args.join(" ")} failed its runtime check.`;
  }
  return null;
}

function repositoryCommand(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", shell: false });
  if (result.status === 0) return null;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().split(/\r?\n/).at(-1);
  return `${command} ${args.join(" ")} failed: ${output || `exit ${result.status}`}`;
}

export async function validateCodexCloudRuntime(env = process.env) {
  const errors = [];
  if (env.CODEX_CLOUD !== "1") errors.push("CODEX_CLOUD must be 1 in the Cloud agent shell.");
  const accessProfile = env.CODEX_CLOUD_ACCESS_PROFILE ?? "offline";
  if (!["offline", "connected"].includes(accessProfile)) {
    errors.push("CODEX_CLOUD_ACCESS_PROFILE must be offline or connected.");
  }
  if (accessProfile === "offline") {
    for (const [name, expected] of Object.entries({
      RAG_PROVIDER_MODE: "offline",
      NEXT_PUBLIC_DEMO_MODE: "true",
      PLAYWRIGHT_OFFLINE_MODE: "true",
    })) {
      if (env[name] !== expected) errors.push(`${name} must be ${expected} in offline mode.`);
    }
    const configured = configuredProviderCredentialNames(env);
    if (configured.length > 0) {
      errors.push(`Offline mode exposes provider credential variables: ${configured.join(", ")}.`);
    }
  }

  for (const error of [
    commandVersion("deno", ["--version"], /^deno 2\./m),
    commandVersion("tesseract", ["--version"], /^tesseract \d+\./m),
  ]) {
    if (error) errors.push(error);
  }
  const pythonError = pythonWorkerImportError(env.CODEX_CLOUD_OCR_PYTHON);
  if (pythonError) errors.push(pythonError);

  for (const error of [
    repositoryCommand(process.execPath, ["scripts/run-tsx.mjs", "scripts/check-runtime.ts"]),
    repositoryCommand(process.execPath, ["scripts/check-installed-lock-parity.mjs"]),
  ]) {
    if (error) errors.push(error);
  }

  if (env.CODEX_CLOUD_SKIP_BROWSER_INSTALL !== "1") {
    try {
      const { chromium, firefox, webkit } = await import("playwright");
      for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
        if (!executableFile(browserType.executablePath())) {
          errors.push(`${name} browser executable is unavailable.`);
        }
      }
    } catch (error) {
      errors.push(`Playwright browser validation failed: ${error.message}`);
    }
  }

  const obsoleteProxyNames = obsoleteNpmProxyVariables(env);
  if (obsoleteProxyNames.length > 0) {
    errors.push(`Obsolete npm proxy variable names are set: ${obsoleteProxyNames.join(", ")}.`);
  }
  if (!localGitBaseline(repoRoot)) errors.push("Neither local main nor origin/main is available.");
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateCodexCloudSetup();
  if (process.argv.includes("--runtime")) errors.push(...(await validateCodexCloudRuntime()));
  if (errors.length > 0) {
    for (const error of errors) console.error(`[Codex Cloud Check] FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    const scope = process.argv.includes("--runtime") ? "static and runtime" : "static";
    console.log(`[Codex Cloud Check] PASS: ${scope} Cloud contracts match.`);
  }
}
