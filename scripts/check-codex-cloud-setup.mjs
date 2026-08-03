#!/usr/bin/env node

import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  CODEX_CLOUD_REPOSITORY,
  hasSafeGitHubCredentialHelper,
  inspectOriginRemote,
} from "./ensure-codex-cloud-git-remote.mjs";
import { providerEnvironmentKeys } from "./test-environment.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const expectedCloudCliVersions = Object.freeze({
  railway: "5.30.4",
  codex: "0.146.0",
});

export const expectedMcpConfiguration = Object.freeze({
  // Canonical form matches `.mcp.json` (no trailing slash).
  railwayUrl: "https://mcp.railway.com",
  supabaseUrl: "https://mcp.supabase.com/mcp",
  supabaseProjectRef: "sjrfecxgysukkwxsowpy",
  supabaseFeatures: Object.freeze(["development", "docs"]),
});

/** Project `.codex/config.toml` registrations — disabled by default, secret-free URLs only. */
export const expectedCodexProjectMcpServers = Object.freeze({
  figma_cloud: Object.freeze({
    url: "https://mcp.figma.com/mcp",
    approvalMode: "writes",
  }),
  railway_cloud: Object.freeze({
    url: expectedMcpConfiguration.railwayUrl,
    approvalMode: "writes",
  }),
  sentry_cloud: Object.freeze({
    url: "https://mcp.sentry.dev/mcp",
    approvalMode: "writes",
  }),
  supabase_cloud: Object.freeze({
    // URL validated with the same project/read-only/feature rules as `.mcp.json`.
    kind: "supabase",
    approvalMode: "prompt",
  }),
});

const allowedCodexProjectMcpKeys = Object.freeze([
  "default_tools_approval_mode",
  "enabled",
  "url",
]);

const forbiddenCodexProjectMcpKeys = Object.freeze([
  "bearer_token_env_var",
  "command",
  "env",
  "env_http_headers",
  "env_vars",
  "headers",
  "http_headers",
]);

function parseTomlScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse `[mcp_servers.name]` tables from a Codex project config.toml.
 * Supports only the scalar keys this gate governs.
 * @param {string} text
 * @returns {{ servers: Record<string, Record<string, unknown>>, nestedServers: Set<string>, unparsedServers: Set<string> }}
 */
export function parseCodexProjectMcpServers(text) {
  /** @type {Record<string, Record<string, unknown>>} */
  const servers = {};
  const nestedServers = new Set();
  const unparsedServers = new Set();
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const nested = line.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)\./);
    if (nested) {
      current = nested[1];
      servers[current] ??= {};
      nestedServers.add(current);
      continue;
    }

    const table = line.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)\]$/);
    if (table) {
      current = table[1];
      servers[current] ??= {};
      continue;
    }

    if (line.startsWith("[")) {
      current = null;
      continue;
    }
    if (!current) {
      const dotted = line.match(
        /^mcp_servers\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_.-]+)\s*=\s*(.+)$/,
      );
      if (dotted) {
        servers[dotted[1]] ??= {};
        servers[dotted[1]][dotted[2]] = parseTomlScalar(dotted[3]);
      }
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!kv) {
      unparsedServers.add(current);
      continue;
    }
    servers[current][kv[1]] = parseTomlScalar(kv[2]);
  }
  return { servers, nestedServers, unparsedServers };
}

function validateSupabaseMcpUrl(urlString, label, errors) {
  try {
    const url = new URL(urlString);
    if (
      `${url.origin}${url.pathname}` !== expectedMcpConfiguration.supabaseUrl
    ) {
      errors.push(`${label} must use the official hosted endpoint.`);
    }
    if (
      url.searchParams.get("project_ref") !==
      expectedMcpConfiguration.supabaseProjectRef
    ) {
      errors.push(`${label} must be scoped to the expected project.`);
    }
    if (url.searchParams.get("read_only") !== "true") {
      errors.push(`${label} must keep the production project read-only.`);
    }
    const queryNames = [...url.searchParams.keys()].sort();
    if (
      JSON.stringify(queryNames) !==
      JSON.stringify(["features", "project_ref", "read_only"])
    ) {
      errors.push(`${label} must not include additional query parameters.`);
    }
    const features = (url.searchParams.get("features") ?? "")
      .split(",")
      .filter(Boolean)
      .sort();
    if (
      JSON.stringify(features) !==
      JSON.stringify(expectedMcpConfiguration.supabaseFeatures)
    ) {
      errors.push(
        `${label} must expose only the approved read-only feature groups.`,
      );
    }
  } catch {
    errors.push(`${label} URL must be valid.`);
  }
}

/**
 * Project `.codex/config.toml` must register the approved MCP surface as disabled
 * URL-only templates so offline/ordinary Codex hosts do not initialize providers.
 * @param {string} text
 * @returns {string[]}
 */
export function validateCodexProjectMcpConfiguration(text) {
  const errors = [];
  const { servers, nestedServers, unparsedServers } =
    parseCodexProjectMcpServers(text);
  const expectedNames = Object.keys(expectedCodexProjectMcpServers).sort();
  const actualNames = Object.keys(servers).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    errors.push(
      `.codex/config.toml must register exactly these MCP servers: ${expectedNames.join(", ")}.`,
    );
  }

  for (const name of expectedNames) {
    const server = servers[name];
    if (!server) continue;
    const label = `.codex/config.toml ${name}`;
    const expected = expectedCodexProjectMcpServers[name];

    if (server.enabled !== false) {
      errors.push(
        `${label} must set enabled = false (host/connected layers opt in).`,
      );
    }
    if (server.default_tools_approval_mode !== expected.approvalMode) {
      const reason =
        expected.approvalMode === "writes"
          ? "write-capable tools require explicit approval"
          : "the production server is constrained read-only";
      errors.push(
        `${label} must set default_tools_approval_mode = "${expected.approvalMode}" because ${reason}.`,
      );
    }
    for (const key of Object.keys(server)) {
      const rootKey = key.split(".")[0];
      if (forbiddenCodexProjectMcpKeys.includes(rootKey)) {
        errors.push(
          `${label} must not embed ${rootKey}; keep OAuth credentials in the host store.`,
        );
      } else if (!allowedCodexProjectMcpKeys.includes(key)) {
        errors.push(`${label} must be URL-only; unsupported key ${key}.`);
      }
    }
    if (nestedServers.has(name)) {
      errors.push(
        `${label} must not declare nested tool override tables in the shared project config.`,
      );
    }
    if (unparsedServers.has(name)) {
      errors.push(`${label} contains unsupported or unparsed entries.`);
    }
    if (typeof server.url !== "string" || !server.url) {
      errors.push(`${label} must declare a secret-free url.`);
      continue;
    }

    if (expected.kind === "supabase") {
      validateSupabaseMcpUrl(server.url, label, errors);
    } else if (server.url !== expected.url) {
      errors.push(`${label} must use the pinned endpoint ${expected.url}.`);
    }
  }

  return errors;
}

export const providerCredentialVariables = Object.freeze([
  ...providerEnvironmentKeys,
  "RAILWAY_API_TOKEN",
  "RAILWAY_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "CODEX_CLOUD_GITHUB_PAT",
  "GITLAB_TOKEN",
  "GLAB_TOKEN",
  "CODEX_TRIGGER_TOKEN",
  "HEALTH_DEEP_PROBE_SECRET",
  "INDEXING_V3_AGENT_SECRET",
  "CROSS_TENANT_SERVICE_ROLE_KEY",
]);

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireMatch(errors, value, pattern, message) {
  if (!pattern.test(value)) errors.push(message);
}

function exactVersionPattern(version) {
  return new RegExp(`\\b${version.replaceAll(".", "\\.")}\\b`);
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function obsoleteNpmProxyVariables(env = process.env) {
  return [
    "npm_config_http_proxy",
    "npm_config_https_proxy",
    "npm_config_proxy",
  ].filter((name) => Object.hasOwn(env, name) && Boolean(env[name]));
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function configuredProviderCredentialNames(env = process.env) {
  return providerCredentialVariables.filter(
    (name) => Object.hasOwn(env, name) && Boolean(env[name]),
  );
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] */
export function validateCodexCloudEnvironment(env = process.env) {
  const errors = [];
  if (env.CODEX_CLOUD !== "1")
    errors.push("CODEX_CLOUD must be 1 in the Cloud agent shell.");

  const accessProfile = env.CODEX_CLOUD_ACCESS_PROFILE ?? "offline";
  if (!["offline", "connected"].includes(accessProfile)) {
    errors.push("CODEX_CLOUD_ACCESS_PROFILE must be offline or connected.");
    return errors;
  }

  const configured = configuredProviderCredentialNames(env);
  if (configured.length > 0) {
    errors.push(
      `${accessProfile === "offline" ? "Offline" : "Connected"} mode exposes provider environment variables: ${configured.join(", ")}.`,
    );
  }

  if (accessProfile === "offline") {
    for (const [name, expected] of Object.entries({
      RAG_PROVIDER_MODE: "offline",
      NEXT_PUBLIC_DEMO_MODE: "true",
      PLAYWRIGHT_OFFLINE_MODE: "true",
    })) {
      if (env[name] !== expected)
        errors.push(`${name} must be ${expected} in offline mode.`);
    }
    return errors;
  }

  for (const [name, allowed] of Object.entries({
    RAG_PROVIDER_MODE: ["offline"],
    NEXT_PUBLIC_DEMO_MODE: ["true", "false"],
    PLAYWRIGHT_OFFLINE_MODE: ["true", "false"],
  })) {
    if (!allowed.includes(env[name]))
      errors.push(`${name} must be an approved value in connected mode.`);
  }
  return errors;
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] */
export function railwayReadCapability(env = process.env, cliAvailable = false) {
  return {
    cliAvailable,
    dedicatedCredentialPresent: Boolean(env.RAILWAY_API_TOKEN),
    projectCredentialPresent: Boolean(env.RAILWAY_TOKEN),
    cliTokenAuthReady: cliAvailable && Boolean(env.RAILWAY_API_TOKEN),
  };
}

export function parseMcpServerMetadata(text) {
  const parsed = JSON.parse(text);
  const servers = parsed?.mcpServers;
  if (!servers || Array.isArray(servers) || typeof servers !== "object") {
    throw new Error(".mcp.json must contain an mcpServers object.");
  }
  return Object.entries(servers).map(([name, server]) => {
    let endpoint = "none";
    let queryNames = [];
    if (typeof server?.url === "string") {
      const url = new URL(server.url);
      endpoint = `${url.origin}${url.pathname}`;
      queryNames = [...url.searchParams.keys()].sort();
    }
    return {
      name,
      type:
        typeof server?.type === "string"
          ? server.type
          : typeof server?.command === "string"
            ? "stdio"
            : "invalid",
      command: typeof server?.command === "string" ? server.command : "none",
      endpoint,
      queryNames,
      environmentNames:
        server?.env &&
        !Array.isArray(server.env) &&
        typeof server.env === "object"
          ? Object.keys(server.env).sort()
          : [],
    };
  });
}

export function validateMcpConfiguration(text) {
  const errors = [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return [
      `.mcp.json is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  const servers = parsed?.mcpServers;
  if (!servers || Array.isArray(servers) || typeof servers !== "object") {
    return [".mcp.json must contain an mcpServers object."];
  }

  const serverNames = Object.keys(servers).sort();
  if (JSON.stringify(serverNames) !== JSON.stringify(["railway", "supabase"])) {
    errors.push(
      "Cloud MCP configuration must contain only Railway and Supabase.",
    );
  }
  for (const name of ["railway", "supabase"]) {
    if (
      servers[name]?.env !== undefined ||
      servers[name]?.headers !== undefined
    ) {
      errors.push(
        `${name} MCP must use hosted OAuth without embedded environment variables or headers.`,
      );
    }
  }

  const railway = servers.railway;
  if (
    railway?.type !== "http" ||
    railway?.url !== expectedMcpConfiguration.railwayUrl.replace(/\/$/, "")
  ) {
    errors.push("Railway MCP must use the hosted OAuth endpoint.");
  }

  const supabase = servers.supabase;
  if (supabase?.type !== "http" || typeof supabase?.url !== "string") {
    errors.push("Supabase MCP must use the hosted HTTP endpoint.");
    return errors;
  }
  try {
    const url = new URL(supabase.url);
    if (
      `${url.origin}${url.pathname}` !== expectedMcpConfiguration.supabaseUrl
    ) {
      errors.push("Supabase MCP must use the official hosted endpoint.");
    }
    if (
      url.searchParams.get("project_ref") !==
      expectedMcpConfiguration.supabaseProjectRef
    ) {
      errors.push("Supabase MCP must be scoped to the expected project.");
    }
    if (url.searchParams.get("read_only") !== "true") {
      errors.push("Supabase MCP must keep the production project read-only.");
    }
    const queryNames = [...url.searchParams.keys()].sort();
    if (
      JSON.stringify(queryNames) !==
      JSON.stringify(["features", "project_ref", "read_only"])
    ) {
      errors.push("Supabase MCP must not include additional query parameters.");
    }
    const features = (url.searchParams.get("features") ?? "")
      .split(",")
      .filter(Boolean)
      .sort();
    if (
      JSON.stringify(features) !==
      JSON.stringify(expectedMcpConfiguration.supabaseFeatures)
    ) {
      errors.push(
        "Supabase MCP must expose only the approved read-only feature groups.",
      );
    }
  } catch {
    errors.push("Supabase MCP URL must be valid.");
  }
  return errors;
}

function approvedModeValue(value, allowed) {
  return allowed.includes(value) ? value : "invalid";
}

export function codexCloudValidationScope({
  runtime = false,
  environment = false,
  browserInstallSkipped = false,
}) {
  if (runtime && browserInstallSkipped) {
    return "static, environment, and source-only runtime (browser validation skipped)";
  }
  if (runtime) return "static, environment, and runtime";
  if (environment) return "static and environment";
  return "static";
}

function commandAvailable(command) {
  return (
    spawnSync(command, ["--version"], { encoding: "utf8", shell: false })
      .status === 0
  );
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] */
export function sanitizedCloudCapabilityLines(env = process.env, options = {}) {
  const origin = options.origin ?? inspectOriginRemote(repoRoot);
  const railway = railwayReadCapability(
    env,
    options.railwayCliAvailable ?? commandAvailable("railway"),
  );
  const codexCliAvailable =
    options.codexCliAvailable ?? commandAvailable("codex");
  const safeGitHelper =
    options.safeGitHelper ?? hasSafeGitHubCredentialHelper(repoRoot);
  const mcpServers =
    options.mcpServers ?? parseMcpServerMetadata(read(".mcp.json"));
  const lines = [
    `CODEX_CLOUD=${approvedModeValue(env.CODEX_CLOUD, ["1"])}`,
    `CODEX_CLOUD_ACCESS_PROFILE=${approvedModeValue(env.CODEX_CLOUD_ACCESS_PROFILE ?? "offline", ["offline", "connected"])}`,
    `RAG_PROVIDER_MODE=${approvedModeValue(env.RAG_PROVIDER_MODE, ["auto", "openai", "offline"])}`,
    `NEXT_PUBLIC_DEMO_MODE=${approvedModeValue(env.NEXT_PUBLIC_DEMO_MODE, ["true", "false"])}`,
    `PLAYWRIGHT_OFFLINE_MODE=${approvedModeValue(env.PLAYWRIGHT_OFFLINE_MODE, ["true", "false"])}`,
  ];
  for (const name of providerCredentialVariables)
    lines.push(`${name}.present=${Boolean(env[name])}`);
  lines.push(`railway.cli_available=${railway.cliAvailable}`);
  lines.push(
    `railway.dedicated_credential_present=${railway.dedicatedCredentialPresent}`,
  );
  lines.push(
    `railway.project_credential_present=${railway.projectCredentialPresent}`,
  );
  lines.push(`railway.cli_token_auth_ready=${railway.cliTokenAuthReady}`);
  lines.push(
    "mcp.runtime_tool_inventory=host-provided-unverified-by-repository",
  );
  lines.push(`codex.cli_available=${codexCliAvailable}`);
  lines.push(pythonWorkerVersionLine(env.CODEX_CLOUD_OCR_PYTHON));
  lines.push(`git.origin_configured=${origin.configured}`);
  lines.push(`git.origin_repository_match=${origin.repositoryMatch}`);
  lines.push(`git.origin_credential_embedded=${origin.credentialsEmbedded}`);
  lines.push(`git.github_cli_helper_configured=${safeGitHelper}`);
  for (const server of mcpServers) {
    lines.push(
      `mcp.server=${server.name} type=${server.type} command=${server.command} endpoint=${server.endpoint} query_names=${server.queryNames.join(",") || "none"} environment_names=${server.environmentNames.join(",") || "none"}`,
    );
  }
  return lines;
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env] */
export function localGitBaseline(root = process.cwd(), env = process.env) {
  for (const ref of ["refs/remotes/origin/main", "refs/heads/main"]) {
    const result = spawnSync("git", ["show-ref", "--verify", "--quiet", ref], {
      cwd: root,
      stdio: "ignore",
    });
    if (result.status === 0) return ref;
  }
  if (env.CODEX_CLOUD === "1") {
    const result = spawnSync(
      "git",
      ["rev-parse", "--verify", "--quiet", "HEAD"],
      {
        cwd: root,
        stdio: "ignore",
      },
    );
    if (result.status === 0) return "HEAD";
  }
  return null;
}

export function executableFile(filePath) {
  try {
    return (
      statSync(filePath).isFile() &&
      (accessSync(filePath, constants.X_OK), true)
    );
  } catch {
    return false;
  }
}

export async function playwrightBrowserErrors(browserTypes, timeout = 15_000) {
  const errors = [];
  for (const [name, browserType] of Object.entries(browserTypes)) {
    if (!executableFile(browserType.executablePath())) {
      errors.push(`${name} browser executable is unavailable.`);
      continue;
    }
    let browser;
    try {
      browser = await browserType.launch({ headless: true, timeout });
    } catch (error) {
      errors.push(
        `${name} browser launch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await browser?.close();
    }
  }
  return errors;
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
  const result = run(
    pythonCommand,
    ["-c", `import ${pythonWorkerImports.join(", ")}`],
    {
      encoding: "utf8",
      shell: false,
    },
  );
  if (result.status === 0) return null;
  return `Python worker imports failed: ${pythonWorkerImports.join(", ")}.`;
}

export function pythonWorkerDependencyErrors(pythonCommand, run = spawnSync) {
  if (!pythonCommand || !executableFile(pythonCommand)) {
    return ["The configured Codex Cloud OCR Python executable is unavailable."];
  }
  const errors = [];
  const pipCheck = run(pythonCommand, ["-m", "pip", "check"], {
    encoding: "utf8",
    shell: false,
  });
  if (pipCheck.status !== 0)
    errors.push(
      "Python worker dependency conflicts were reported by pip check.",
    );

  const requirements = readFileSync(
    path.join(repoRoot, "worker/python/requirements-cloud.txt"),
  );
  const expectedHash = createHash("sha256").update(requirements).digest("hex");
  const markerPath = path.resolve(
    path.dirname(pythonCommand),
    "..",
    ".requirements-cloud.sha256",
  );
  let installedHash = "";
  try {
    installedHash = readFileSync(markerPath, "utf8").trim();
  } catch {
    errors.push(
      "Python worker requirements fingerprint is missing; rerun Cloud setup.",
    );
  }
  if (installedHash && installedHash !== expectedHash) {
    errors.push(
      "Python worker requirements fingerprint is stale; rerun Cloud setup.",
    );
  }

  const versions = run(
    pythonCommand,
    [
      "-c",
      "from importlib.metadata import version; print('medspacy=%s spacy=%s' % (version('medspacy'), version('spacy')))",
    ],
    { encoding: "utf8", shell: false },
  );
  if (versions.status !== 0)
    errors.push("Python worker medspacy/spacy version reporting failed.");
  return errors;
}

export function pythonWorkerVersionLine(pythonCommand, run = spawnSync) {
  if (!pythonCommand || !executableFile(pythonCommand))
    return "python.worker_versions=unavailable";
  const result = run(
    pythonCommand,
    [
      "-c",
      "from importlib.metadata import version; print('medspacy=%s spacy=%s' % (version('medspacy'), version('spacy')))",
    ],
    { encoding: "utf8", shell: false },
  );
  return result.status === 0
    ? `python.worker_versions=${String(result.stdout ?? "")
        .trim()
        .replaceAll(/\\s+/g, ",")}`
    : "python.worker_versions=unavailable";
}

export function validateCodexCloudSetup() {
  const errors = [];
  const packageJson = JSON.parse(read("package.json"));
  const nodeVersion = read(".node-version").trim();
  const nvmVersion = read(".nvmrc").trim();
  const setup = read("scripts/setup-codex-cloud.sh");
  const maintenance = read("scripts/maintain-codex-cloud.sh");
  const commandShims = read("scripts/install-codex-cloud-command-shims.sh");
  const rawEnvironmentProbe = read("scripts/check-codex-cloud-raw-env.sh");
  const patDelete = read("scripts/delete-codex-cloud-branch-with-pat.sh");
  const guide = read("docs/codex-cloud.md");
  const agents = read("AGENTS.md");
  const envExample = read(".env.example");
  const gitignore = read(".gitignore");
  const mcp = read(".mcp.json");
  const codexProjectConfig = read(".codex/config.toml");

  if (packageJson.engines?.node !== `${nodeVersion}.x`) {
    errors.push(
      `package.json engines.node must match .node-version (${nodeVersion}.x).`,
    );
  }
  if (packageJson.engines?.npm !== "11.x")
    errors.push("package.json must require npm 11.x.");
  if (!String(packageJson.packageManager ?? "").startsWith("npm@11.")) {
    errors.push("package.json packageManager must pin npm 11.x.");
  }
  if (nvmVersion !== nodeVersion)
    errors.push(".nvmrc and .node-version must match.");
  requireMatch(
    errors,
    gitignore,
    /^\/error\.log$/m,
    "Codex Cloud diagnostic error.log must stay ignored.",
  );

  for (const [pattern, message] of [
    [
      /npm ci --include=dev/,
      "Cloud setup must install the exact lockfile with dev dependencies.",
    ],
    [/deno@2/, "Cloud setup must install Deno 2.x."],
    [
      /worker\/python\/requirements-cloud\.txt/,
      "Cloud setup must install the Python 3.12 Cloud worker lock.",
    ],
    [
      /CODEX_CLOUD_OCR_PYTHON/,
      "Cloud setup must expose the Python worker environment.",
    ],
    [
      /playwright install --with-deps chromium firefox webkit/,
      "Cloud setup must install every browser.",
    ],
    [
      /CODEX_CLOUD_ACCESS_PROFILE/,
      "Cloud setup must support explicit access profiles.",
    ],
    [
      /RAG_PROVIDER_MODE=offline/,
      "Cloud setup must default RAG to offline mode.",
    ],
    [
      /unset OPENAI_API_KEY/,
      "Cloud setup must remove raw provider variables from the agent shell.",
    ],
    [/\.bash_profile/, "Cloud setup must cover Bash login-profile precedence."],
    [/@railway\/cli/, "Cloud setup must install the Railway CLI."],
    [/@openai\/codex/, "Cloud setup must install the Codex CLI."],
    [
      /ensure-codex-cloud-git-remote\.mjs/,
      "Cloud setup must restore a safe origin remote.",
    ],
    [
      /check:codex-cloud -- --runtime/,
      "Cloud setup must run runtime acceptance.",
    ],
    [
      /BEGIN clinical-kb-codex-cloud shell policy/,
      "Cloud setup must write the Codex shell policy inside a managed marker block.",
    ],
    [
      /Unmanaged \[shell_environment_policy\] table found/,
      "Cloud setup must reject unmanaged shell_environment_policy tables before rewriting config.toml.",
    ],
    [
      /Incomplete managed shell policy block/,
      "Cloud setup must reject incomplete managed shell policy marker blocks.",
    ],
    [
      /export RAG_PROVIDER_MODE="\$\{rag_provider_mode\}"/,
      "Cloud setup must pin the connected-mode retrieval value at setup time.",
    ],
    [
      /inherit = "all"/,
      "Cloud setup must configure Codex shell_environment_policy inheritance.",
    ],
    [
      /CODEX_CLOUD_SETUP_STOP_AFTER_POLICY/,
      "Cloud setup must expose a policy-only stop for behavior-level tests.",
    ],
  ]) {
    requireMatch(errors, setup, pattern, message);
  }
  if (
    !setup.includes(`railway_cli_version="${expectedCloudCliVersions.railway}"`)
  ) {
    errors.push(
      "Cloud setup Railway CLI version must match the checked runtime contract.",
    );
  }
  if (
    !setup.includes(`codex_cli_version="${expectedCloudCliVersions.codex}"`)
  ) {
    errors.push(
      "Cloud setup Codex CLI version must match the checked runtime contract.",
    );
  }
  for (const name of providerCredentialVariables) {
    if (!setup.includes(name))
      errors.push(
        `Cloud setup must handle provider environment variable ${name}.`,
      );
  }
  const providerScrubIndex = setup.indexOf("unset OPENAI_API_KEY");
  const accessProfileBranchIndex = setup.indexOf(
    'if [ "\\$CODEX_CLOUD_ACCESS_PROFILE" = "connected" ]',
  );
  if (
    providerScrubIndex < 0 ||
    accessProfileBranchIndex < 0 ||
    providerScrubIndex > accessProfileBranchIndex
  ) {
    errors.push(
      "Cloud setup must scrub provider environment variables before selecting an access profile.",
    );
  }
  const credentialLikeExampleNames = [
    ...envExample.matchAll(
      /^([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|DB_URL))=/gm,
    ),
  ].map(([, name]) => name);
  for (const name of credentialLikeExampleNames) {
    if (!providerCredentialVariables.includes(name)) {
      errors.push(
        `Cloud credential inventory must include .env.example variable ${name}.`,
      );
    }
  }
  requireMatch(
    errors,
    maintenance,
    /exec bash scripts\/setup-codex-cloud\.sh/,
    "Maintenance must repair the full toolchain.",
  );
  requireMatch(
    errors,
    maintenance,
    /ensure-codex-cloud-git-remote\.mjs/,
    "Maintenance must preserve the safe origin remote.",
  );
  requireMatch(
    errors,
    commandShims,
    /nvm which/,
    "Cloud command shims must resolve the selected Node version through nvm.",
  );
  requireMatch(
    errors,
    commandShims,
    /mkdir -p "\$HOME\/\.local\/bin"/,
    "Cloud command shims must create their destination directory.",
  );
  requireMatch(
    errors,
    commandShims,
    /\.clinical-kb-codex-cloud\.sh/,
    "Cloud command shims must load the generated profile.",
  );
  if (!commandShims.includes('exec "$node_bin/$command_name" "\\$@"')) {
    errors.push("Cloud command shims must execute absolute Node commands.");
  }
  requireMatch(
    errors,
    patDelete,
    /CODEX_CLOUD.*use native Push/,
    "PAT deletion helper must reject the Codex Cloud agent phase and direct operators to native publication.",
  );
  requireMatch(
    errors,
    rawEnvironmentProbe,
    /never values/,
    "Raw Cloud environment probe must report names only.",
  );
  for (const name of providerCredentialVariables) {
    if (!rawEnvironmentProbe.includes(name)) {
      errors.push(
        `Raw Cloud environment probe must cover provider environment variable ${name}.`,
      );
    }
  }
  requireMatch(
    errors,
    patDelete,
    /\[\[ "\$branch" != -\* \]\]/,
    "PAT deletion helper must reject option-like branch names.",
  );
  requireMatch(
    errors,
    patDelete,
    /git check-ref-format --branch/,
    "PAT deletion helper must validate branch names.",
  );
  requireMatch(
    errors,
    patDelete,
    /git remote get-url --push --all origin/,
    "PAT deletion helper must validate effective push URLs.",
  );
  requireMatch(
    errors,
    patDelete,
    /GIT_ASKPASS/,
    "PAT deletion helper must use a temporary askpass program.",
  );
  requireMatch(
    errors,
    patDelete,
    /core\.hooksPath=\/dev\/null/,
    "PAT deletion helper must disable Git hooks before the token-bearing push.",
  );
  requireMatch(
    errors,
    patDelete,
    /https:\/\/github\.com\/BigSimmo\/Database\.git/,
    "PAT deletion helper must require the credential-free origin.",
  );
  requireMatch(
    errors,
    guide,
    /bash scripts\/setup-codex-cloud\.sh/,
    "The guide must provide the setup command.",
  );
  requireMatch(
    errors,
    guide,
    /install-codex-cloud-command-shims\.sh/,
    "The guide must document the command-shim workaround.",
  );
  requireMatch(
    errors,
    guide,
    /CODEX_CLOUD_ACCESS_PROFILE=connected/,
    "The guide must document connected access.",
  );
  requireMatch(
    errors,
    guide,
    /CODEX_CLOUD_GITHUB_PAT/,
    "The guide must document the narrowly scoped PAT exception.",
  );
  requireMatch(
    errors,
    guide,
    /GitHub connector/,
    "The guide must document GitHub connector access.",
  );
  try {
    parseMcpServerMetadata(mcp);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  errors.push(...validateMcpConfiguration(mcp));
  errors.push(...validateCodexProjectMcpConfiguration(codexProjectConfig));

  for (const command of [
    "check:supabase-project",
    "test:live",
    "eval:rag",
    "eval:quality",
    "eval:retrieval",
    "verify:release",
  ]) {
    if (setup.includes(command) || maintenance.includes(command)) {
      errors.push(
        `Cloud bootstrap scripts must not invoke provider-capable command ${command}.`,
      );
    }
  }

  for (const pattern of [
    /sjrfecxgysukkwxsowpy/i,
    /5deaad0b-675a-4c13-978e-5ca2b5b877f9/i,
    /sk-[A-Za-z0-9_-]{12,}/,
    /sb_secret_[A-Za-z0-9_-]{8,}/,
  ]) {
    if (pattern.test(setup) || pattern.test(maintenance)) {
      errors.push(
        `Cloud bootstrap scripts contain a live provider identifier matching ${pattern}.`,
      );
    }
  }

  const cloudHeadingCount = (
    agents.match(/^## Codex Cloud environment$/gm) ?? []
  ).length;
  if (cloudHeadingCount !== 1) {
    errors.push(
      `AGENTS.md must contain exactly one Codex Cloud environment section; found ${cloudHeadingCount}.`,
    );
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
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status === 0) return null;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .trim()
    .split(/\r?\n/)
    .at(-1);
  return `${command} ${args.join(" ")} failed: ${output || `exit ${result.status}`}`;
}

export async function validateCodexCloudRuntime(env = process.env) {
  const errors = validateCodexCloudEnvironment(env);

  for (const error of [
    commandVersion("deno", ["--version"], /^deno 2\./m),
    commandVersion("tesseract", ["--version"], /^tesseract \d+\./m),
    commandVersion(
      "railway",
      ["--version"],
      exactVersionPattern(expectedCloudCliVersions.railway),
    ),
    commandVersion(
      "codex",
      ["--version"],
      exactVersionPattern(expectedCloudCliVersions.codex),
    ),
  ]) {
    if (error) errors.push(error);
  }
  const pythonError = pythonWorkerImportError(env.CODEX_CLOUD_OCR_PYTHON);
  if (pythonError) errors.push(pythonError);
  else errors.push(...pythonWorkerDependencyErrors(env.CODEX_CLOUD_OCR_PYTHON));

  for (const error of [
    repositoryCommand(process.execPath, [
      "scripts/run-tsx.mjs",
      "scripts/check-runtime.ts",
    ]),
    repositoryCommand(process.execPath, [
      "scripts/check-installed-lock-parity.mjs",
    ]),
  ]) {
    if (error) errors.push(error);
  }

  if (env.CODEX_CLOUD_SKIP_BROWSER_INSTALL !== "1") {
    try {
      const { chromium, firefox, webkit } = await import("playwright");
      errors.push(
        ...(await playwrightBrowserErrors({ chromium, firefox, webkit })),
      );
    } catch (error) {
      errors.push(`Playwright browser validation failed: ${error.message}`);
    }
  }

  const obsoleteProxyNames = obsoleteNpmProxyVariables(env);
  if (obsoleteProxyNames.length > 0) {
    errors.push(
      `Obsolete npm proxy variable names are set: ${obsoleteProxyNames.join(", ")}.`,
    );
  }
  const baseline = localGitBaseline(repoRoot, env);
  if (!baseline) {
    errors.push(
      "Neither local main, origin/main, nor a Cloud task HEAD is available.",
    );
  } else if (baseline === "HEAD" && !env.CODEX_CLOUD_EXPECTED_BASE_SHA) {
    errors.push(
      "Checkout freshness is unverified: set CODEX_CLOUD_EXPECTED_BASE_SHA to the intended merge/base commit.",
    );
  }
  if (env.CODEX_CLOUD_EXPECTED_BASE_SHA) {
    const expectedBase = spawnSync(
      "git",
      [
        "merge-base",
        "--is-ancestor",
        env.CODEX_CLOUD_EXPECTED_BASE_SHA,
        "HEAD",
      ],
      { cwd: repoRoot, stdio: "ignore" },
    );
    if (expectedBase.status !== 0) {
      errors.push(
        "CODEX_CLOUD_EXPECTED_BASE_SHA is not an ancestor of the current HEAD.",
      );
    }
  }
  const origin = inspectOriginRemote(repoRoot);
  if (!origin.configured)
    errors.push("origin is unavailable in the Cloud checkout.");
  else if (origin.credentialsEmbedded)
    errors.push("origin contains embedded credentials.");
  else if (!origin.repositoryMatch)
    errors.push(`origin must identify ${CODEX_CLOUD_REPOSITORY}.`);
  return errors;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = validateCodexCloudSetup();
  const runtime = process.argv.includes("--runtime");
  const environment =
    runtime ||
    process.env.CODEX_CLOUD === "1" ||
    process.argv.includes("--environment");
  if (runtime) errors.push(...(await validateCodexCloudRuntime()));
  else if (environment) errors.push(...validateCodexCloudEnvironment());
  if (environment) {
    console.log(
      "[Codex Cloud Environment] sanitized effective modes and capabilities:",
    );
    for (const line of sanitizedCloudCapabilityLines())
      console.log(`  ${line}`);
  }
  if (errors.length > 0) {
    for (const error of errors)
      console.error(`[Codex Cloud Check] FAIL: ${error}`);
    process.exitCode = 1;
  } else {
    const scope = codexCloudValidationScope({
      runtime,
      environment,
      browserInstallSkipped:
        process.env.CODEX_CLOUD_SKIP_BROWSER_INSTALL === "1",
    });
    console.log(`[Codex Cloud Check] PASS: ${scope} Cloud contracts match.`);
  }
}
