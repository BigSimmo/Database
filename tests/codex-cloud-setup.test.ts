import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  codexCloudValidationScope,
  configuredProviderCredentialNames,
  expectedMcpConfiguration,
  executableFile,
  localGitBaseline,
  obsoleteNpmProxyVariables,
  parseMcpServerMetadata,
  playwrightBrowserErrors,
  providerCredentialVariables,
  pythonWorkerImportError,
  pythonWorkerImports,
  railwayReadCapability,
  sanitizedCloudCapabilityLines,
  validateCodexCloudEnvironment,
  validateCodexProjectMcpConfiguration,
  validateMcpConfiguration,
} from "../scripts/check-codex-cloud-setup.mjs";
import { providerEnvironmentKeys } from "../scripts/test-environment.mjs";
import {
  CODEX_CLOUD_ORIGIN_URL,
  ensureOriginRemote,
  inspectOriginRemote,
} from "../scripts/ensure-codex-cloud-git-remote.mjs";

const temporaryDirectories: string[] = [];
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const setupScript = "scripts/setup-codex-cloud.sh";
const bashCommand =
  process.platform === "win32"
    ? path.join(
        process.env.ProgramFiles || "C:\\Program Files",
        "Git/bin/bash.exe",
      )
    : "bash";
const requiredPolicyExcludes = [
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "OPENAI_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_PROJECT_NAME",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "CROSS_TENANT_SERVICE_ROLE_KEY",
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
  "E2E_AUTH_ENABLED",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "ALLOW_PROVIDER_TESTS",
] as const;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function temporaryGitRepository() {
  const directory = temporaryDirectory("codex-cloud-git-");
  expect(
    spawnSync("git", ["init", "--quiet", "--initial-branch=task", directory])
      .status,
  ).toBe(0);
  return directory;
}

function git(directory: string, ...args: string[]) {
  return spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
}

function bashPathEntry(entry: string) {
  if (process.platform !== "win32") return entry;
  return entry
    .replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`)
    .replaceAll("\\", "/");
}

function bashPathList(value: string) {
  if (process.platform !== "win32") return value;
  return value
    .split(path.delimiter)
    .filter(Boolean)
    .map(bashPathEntry)
    .join(":");
}

function runSetupPolicyOnly(
  home: string,
  env: Record<string, string | undefined> = {},
) {
  // The test redirects HOME to isolate the generated Codex config. Put the
  // running test process's Node binary first so version-manager launchers that
  // resolve their runtime through HOME remain usable until setup reaches the
  // policy-only stop.
  const nodeBin = path.dirname(process.execPath);
  const requestedPath =
    env.PATH ||
    [nodeBin, process.env.PATH].filter(Boolean).join(path.delimiter);
  return spawnSync(bashCommand, [setupScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: bashPathEntry(home),
      CODEX_CLOUD_SETUP_STOP_AFTER_POLICY: "1",
      ...env,
      PATH: bashPathList(requestedPath),
    },
  });
}

function readCodexConfig(home: string) {
  return readFileSync(path.join(home, ".codex/config.toml"), "utf8");
}

function readRuntimeProfile(home: string) {
  return readFileSync(path.join(home, ".clinical-kb-codex-cloud.sh"), "utf8");
}

describe("Codex Cloud environment contract", () => {
  it("keeps the checked-in setup reproducible and provider-safe", () => {
    const staticEnvironment = { ...process.env };
    delete staticEnvironment.CODEX_CLOUD;
    const result = spawnSync(
      process.execPath,
      ["scripts/check-codex-cloud-setup.mjs"],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        env: staticEnvironment,
        shell: false,
      },
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(
      "[Codex Cloud Check] PASS: static Cloud contracts match.",
    );
  });

  it("reports sensitive and proxy variable names without exposing values", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      OPENAI_API_KEY: "never-print-this",
      CROSS_TENANT_SERVICE_ROLE_KEY: "never-print-this-either",
      npm_config_https_proxy: "https://user:secret@example.test",
      HTTP_PROXY: "http://supported.example.test",
    };

    expect(configuredProviderCredentialNames(env)).toEqual([
      "OPENAI_API_KEY",
      "CROSS_TENANT_SERVICE_ROLE_KEY",
    ]);
    expect(
      configuredProviderCredentialNames({
        CODEX_CLOUD_GITHUB_PAT: "never-print-this",
      }),
    ).toEqual(["CODEX_CLOUD_GITHUB_PAT"]);
    expect(obsoleteNpmProxyVariables(env)).toEqual(["npm_config_https_proxy"]);
  });

  it("covers every provider-capable test variable in the Cloud credential inventory", () => {
    for (const key of providerEnvironmentKeys)
      expect(providerCredentialVariables).toContain(key);
  });

  it("validates effective offline modes and keeps connected verification explicit", () => {
    const offline = {
      CODEX_CLOUD: "1",
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
      RAG_PROVIDER_MODE: "offline",
      NEXT_PUBLIC_DEMO_MODE: "true",
      PLAYWRIGHT_OFFLINE_MODE: "true",
    };
    expect(validateCodexCloudEnvironment(offline)).toEqual([]);
    expect(
      validateCodexCloudEnvironment({
        ...offline,
        NEXT_PUBLIC_DEMO_MODE: "false",
      }),
    ).toContain("NEXT_PUBLIC_DEMO_MODE must be true in offline mode.");
    expect(
      validateCodexCloudEnvironment({
        ...offline,
        CODEX_CLOUD_ACCESS_PROFILE: "connected",
        RAG_PROVIDER_MODE: "auto",
        NEXT_PUBLIC_DEMO_MODE: "false",
        PLAYWRIGHT_OFFLINE_MODE: "false",
      }),
    ).toContain(
      "RAG_PROVIDER_MODE must be an approved value in connected mode.",
    );

    expect(
      validateCodexCloudEnvironment({
        ...offline,
        CODEX_CLOUD_ACCESS_PROFILE: "connected",
        RAG_PROVIDER_MODE: "offline",
        SUPABASE_ACCESS_TOKEN: "setup-only-secret",
      }),
    ).toContain(
      "Connected mode exposes provider environment variables: SUPABASE_ACCESS_TOKEN.",
    );
  });

  it("emits sanitized modes, credential presence, and MCP metadata only", () => {
    const secret = "sensitive-test-value";
    const lines = sanitizedCloudCapabilityLines(
      {
        CODEX_CLOUD: "1",
        CODEX_CLOUD_ACCESS_PROFILE: "offline",
        RAG_PROVIDER_MODE: "offline",
        NEXT_PUBLIC_DEMO_MODE: "true",
        PLAYWRIGHT_OFFLINE_MODE: "true",
        OPENAI_API_KEY: secret,
      },
      {
        origin: {
          configured: true,
          repositoryMatch: true,
          credentialsEmbedded: false,
        },
        railwayCliAvailable: true,
        codexCliAvailable: true,
        safeGitHelper: true,
        mcpServers: [
          {
            name: "railway",
            type: "http",
            command: "none",
            endpoint: "https://mcp.railway.com/",
            queryNames: [],
            environmentNames: [],
          },
        ],
      },
    );
    const report = lines.join("\n");
    expect(report).toContain("OPENAI_API_KEY.present=true");
    expect(report).toContain(
      "mcp.server=railway type=http command=none endpoint=https://mcp.railway.com/",
    );
    expect(report).not.toContain(secret);
    expect(report).not.toContain("sensitive-test");
  });

  it("requires the Railway CLI and dedicated account token without substituting a project token", () => {
    expect(
      railwayReadCapability({ RAILWAY_API_TOKEN: "configured" }, true)
        .cliTokenAuthReady,
    ).toBe(true);
    expect(
      railwayReadCapability({ RAILWAY_TOKEN: "configured" }, true),
    ).toMatchObject({
      dedicatedCredentialPresent: false,
      projectCredentialPresent: true,
      cliTokenAuthReady: false,
    });
    expect(
      railwayReadCapability({ RAILWAY_API_TOKEN: "configured" }, false)
        .cliTokenAuthReady,
    ).toBe(false);
  });

  it("parses MCP transport metadata without query or environment values", () => {
    const secret = "never-print-mcp-value";
    const metadata = parseMcpServerMetadata(
      JSON.stringify({
        mcpServers: {
          supabase: {
            type: "http",
            url: `https://mcp.supabase.com/mcp?project_ref=example&read_only=true&token=${secret}`,
            env: { SUPABASE_ACCESS_TOKEN: secret },
          },
        },
      }),
    );
    expect(metadata).toEqual([
      {
        name: "supabase",
        type: "http",
        command: "none",
        endpoint: "https://mcp.supabase.com/mcp",
        queryNames: ["project_ref", "read_only", "token"],
        environmentNames: ["SUPABASE_ACCESS_TOKEN"],
      },
    ]);
    expect(JSON.stringify(metadata)).not.toContain(secret);
  });

  it("requires hosted Railway OAuth and project-scoped read-only Supabase MCP", () => {
    const valid = JSON.stringify({
      mcpServers: {
        railway: {
          type: "http",
          url: expectedMcpConfiguration.railwayUrl.replace(/\/$/, ""),
        },
        supabase: {
          type: "http",
          url: `${expectedMcpConfiguration.supabaseUrl}?project_ref=${expectedMcpConfiguration.supabaseProjectRef}&read_only=true&features=${expectedMcpConfiguration.supabaseFeatures.join(",")}`,
        },
      },
    });
    expect(validateMcpConfiguration(valid)).toEqual([]);
    expect(
      validateMcpConfiguration(
        valid.replace("read_only=true", "read_only=false"),
      ),
    ).toContain("Supabase MCP must keep the production project read-only.");
    expect(
      validateMcpConfiguration(
        valid.replace('"supabase":', '"unexpected":{},"supabase":'),
      ),
    ).toContain(
      "Cloud MCP configuration must contain only Railway and Supabase.",
    );
    expect(
      validateMcpConfiguration(
        valid.replace('"railway":{"type"', '"railway":{"headers":{},"type"'),
      ),
    ).toContain(
      "railway MCP must use hosted OAuth without embedded environment variables or headers.",
    );
    expect(
      validateMcpConfiguration(
        valid.replace("&read_only=true", "&read_only=true&token=forbidden"),
      ),
    ).toContain("Supabase MCP must not include additional query parameters.");
    expect(
      validateMcpConfiguration(
        valid.replace("&read_only=true", "&read_only=true&read_only=false"),
      ),
    ).toContain("Supabase MCP must not include additional query parameters.");
  });

  it("keeps project .codex/config.toml MCP registrations disabled and secret-free", () => {
    const tracked = readFileSync(
      new URL("../.codex/config.toml", import.meta.url),
      "utf8",
    );
    expect(validateCodexProjectMcpConfiguration(tracked)).toEqual([]);
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replaceAll("enabled = false", "enabled = true"),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must set enabled = false (host/connected layers opt in).`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          'default_tools_approval_mode = "writes"',
          'default_tools_approval_mode = "auto"',
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must set default_tools_approval_mode = "writes" because write-capable tools require explicit approval.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          'default_tools_approval_mode = "prompt"',
          'default_tools_approval_mode = "auto"',
        ),
      ),
    ).toContain(
      `.codex/config.toml supabase_cloud must set default_tools_approval_mode = "prompt" because the production server is constrained read-only.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          'url = "https://mcp.figma.com/mcp"',
          'url = "https://mcp.figma.com/mcp"\nbearer_token_env_var = "FIGMA_TOKEN"',
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must not embed bearer_token_env_var; keep OAuth credentials in the host store.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          'url = "https://mcp.figma.com/mcp"',
          'url = "https://mcp.figma.com/mcp"\nhttp_headers.Authorization = "Bearer redacted-test"',
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must not embed http_headers; keep OAuth credentials in the host store.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          'url = "https://mcp.figma.com/mcp"',
          'url = "https://mcp.figma.com/mcp"\nscopes = ["files:write"]',
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must be URL-only; unsupported key scopes.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          'url = "https://mcp.figma.com/mcp"',
          'url = "https://mcp.figma.com/mcp"\n__anything = "secret"',
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must be URL-only; unsupported key __anything.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          "[mcp_servers.supabase_cloud]",
          "[mcp_servers.figma_cloud.tools]\n__hasNestedTables = false\n\n[mcp_servers.supabase_cloud]",
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must not declare nested tool override tables in the shared project config.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          "[mcp_servers.figma_cloud]",
          'mcp_servers.figma_cloud.http_headers.Authorization = "Bearer redacted-test"\n\n[mcp_servers.figma_cloud]',
        ),
      ),
    ).toContain(
      `.codex/config.toml figma_cloud must not embed http_headers; keep OAuth credentials in the host store.`,
    );
    expect(
      validateCodexProjectMcpConfiguration(
        tracked.replace(
          "project_ref=sjrfecxgysukkwxsowpy&read_only=true&features=",
          "project_ref=sjrfecxgysukkwxsowpy&read_only=false&features=",
        ),
      ),
    ).toContain(
      `.codex/config.toml supabase_cloud must keep the production project read-only.`,
    );
  });

  it("probes the raw task environment without printing credential values", () => {
    const secret = "never-print-raw-provider-value";
    const result = spawnSync(
      bashCommand,
      ["scripts/check-codex-cloud-raw-env.sh"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { PATH: process.env.PATH, OPENAI_API_KEY: secret },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("OPENAI_API_KEY");
    expect(result.stderr).not.toContain(secret);
  });

  it("keeps setup and maintenance repairs guarded for repeat execution", () => {
    const setup = readFileSync(
      new URL("../scripts/setup-codex-cloud.sh", import.meta.url),
      "utf8",
    );
    const maintenance = readFileSync(
      new URL("../scripts/maintain-codex-cloud.sh", import.meta.url),
      "utf8",
    );
    const commandShims = readFileSync(
      new URL(
        "../scripts/install-codex-cloud-command-shims.sh",
        import.meta.url,
      ),
      "utf8",
    );
    const patDelete = readFileSync(
      new URL(
        "../scripts/delete-codex-cloud-branch-with-pat.sh",
        import.meta.url,
      ),
      "utf8",
    );
    expect(setup).toContain("if ! grep -Fq '.clinical-kb-codex-cloud.sh'");
    expect(setup).toContain(
      'if [[ "$actual_version" != "$expected_version" ]]',
    );
    expect(setup).toContain('"$HOME/.bash_profile"');
    expect(
      setup.match(
        /unset npm_config_http_proxy npm_config_https_proxy npm_config_proxy/g,
      ),
    ).toHaveLength(2);
    expect(setup.indexOf("unset OPENAI_API_KEY")).toBeLessThan(
      setup.indexOf('if [ "\\$CODEX_CLOUD_ACCESS_PROFILE" = "connected" ]'),
    );
    expect(setup).toContain("BEGIN clinical-kb-codex-cloud shell policy");
    expect(setup).toContain("END clinical-kb-codex-cloud shell policy");
    expect(setup).toContain("[shell_environment_policy]");
    expect(setup).toContain('inherit = "all"');
    expect(setup).toContain("Unmanaged [shell_environment_policy] table found");
    expect(setup).toContain("Incomplete managed shell policy block");
    expect(setup).toContain('export RAG_PROVIDER_MODE="${rag_provider_mode}"');
    expect(setup).toContain('rag_provider_mode="${RAG_PROVIDER_MODE:-auto}"');
    expect(setup).not.toContain(
      'RAG_PROVIDER_MODE="\\${RAG_PROVIDER_MODE:-auto}"',
    );
    expect(setup).toContain("SUPABASE_URL");
    expect(setup).toContain("SUPABASE_PROJECT_REF");
    expect(setup).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(setup).toContain("DATABASE_URL");
    expect(setup).toContain("CODEX_CLOUD_SETUP_STOP_AFTER_POLICY");
    expect(setup).toContain("CODEX_CLOUD_SETUP_TEST_FAIL_ATOMIC_WRITE");
    expect(setup).toContain("worker/python/requirements-cloud.txt");
    expect(setup).toContain("diagnose-codex-cloud.mjs");
    expect(setup).toContain("trap diagnose_setup_failure ERR");
    expect(setup).toContain('setup_step="python-worker-requirements"');
    expect(setup).toContain(
      "--require-hashes -r worker/python/requirements-cloud.txt",
    );
    expect(setup).toContain('"$ocr_venv/bin/python" -m pip check');
    expect(maintenance).toContain("ensure-codex-cloud-git-remote.mjs");
    expect(commandShims).toContain('nvm which "$expected_node_major"');
    expect(commandShims).toContain('. "$runtime_profile"');
    expect(commandShims).toContain('mkdir -p "$HOME/.local/bin"');
    expect(patDelete).toContain('[[ "${CODEX_CLOUD:-0}" != "1" ]]');
    expect(patDelete).toContain('[[ "$branch" != -* ]]');
    expect(patDelete).toContain("git check-ref-format --branch");
    expect(patDelete).toContain("git remote get-url --push --all origin");
    expect(patDelete).toContain("GIT_ASKPASS");
    expect(patDelete).toContain("core.hooksPath=/dev/null");
  });

  it("writes managed shell policy behaviorally and preserves unrelated Codex config", () => {
    const home = temporaryDirectory("codex-cloud-home-");
    mkdirSync(path.join(home, ".codex"), { recursive: true });
    writeFileSync(
      path.join(home, ".codex/config.toml"),
      ["[mcp_servers.example]", 'command = "echo"', 'args = ["ping"]', ""].join(
        "\n",
      ),
    );

    const first = runSetupPolicyOnly(home, {
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
    });
    expect(first.status, first.stderr || first.stdout).toBe(0);

    const config = readCodexConfig(home);
    expect(config).toContain("[mcp_servers.example]");
    expect(config).toContain("BEGIN clinical-kb-codex-cloud shell policy");
    expect(config).toContain("[shell_environment_policy]");
    expect(config).toContain('inherit = "all"');
    for (const name of requiredPolicyExcludes) {
      expect(config).toContain(`"${name}"`);
    }
    expect(config.match(/^\[shell_environment_policy\]$/gm)).toHaveLength(1);

    const profile = readRuntimeProfile(home);
    expect(profile).toContain('export CODEX_CLOUD_ACCESS_PROFILE="offline"');
    expect(profile).toContain("export RAG_PROVIDER_MODE=offline");

    const second = runSetupPolicyOnly(home, {
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
    });
    expect(second.status, second.stderr || second.stdout).toBe(0);
    const rewritten = readCodexConfig(home);
    expect(rewritten).toContain("[mcp_servers.example]");
    expect(rewritten.match(/^\[shell_environment_policy\]$/gm)).toHaveLength(1);
    expect(
      rewritten.match(/BEGIN clinical-kb-codex-cloud shell policy/g),
    ).toHaveLength(1);
  });

  it("pins connected retrieval mode and rejects unsafe shell-policy configs", () => {
    const connectedHome = temporaryDirectory("codex-cloud-connected-");
    const connected = runSetupPolicyOnly(connectedHome, {
      CODEX_CLOUD_ACCESS_PROFILE: "connected",
      RAG_PROVIDER_MODE: "offline",
    });
    expect(connected.status, connected.stderr || connected.stdout).toBe(0);
    const connectedProfile = readRuntimeProfile(connectedHome);
    expect(connectedProfile).toContain(
      'export CODEX_CLOUD_ACCESS_PROFILE="connected"',
    );
    expect(connectedProfile).toContain('export RAG_PROVIDER_MODE="offline"');
    expect(connectedProfile).not.toContain("${RAG_PROVIDER_MODE:-auto}");

    const unmanagedHome = temporaryDirectory("codex-cloud-unmanaged-");
    mkdirSync(path.join(unmanagedHome, ".codex"), { recursive: true });
    const unmanagedConfig = [
      "[mcp_servers.keep]",
      'command = "echo"',
      "",
      "[shell_environment_policy]",
      'inherit = "all"',
      "exclude = []",
      "",
    ].join("\n");
    const unmanagedPath = path.join(unmanagedHome, ".codex/config.toml");
    writeFileSync(unmanagedPath, unmanagedConfig);
    const unmanaged = runSetupPolicyOnly(unmanagedHome, {
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
    });
    expect(unmanaged.status).not.toBe(0);
    expect(unmanaged.stderr).toContain(
      "Unmanaged [shell_environment_policy] table found",
    );
    expect(readFileSync(unmanagedPath, "utf8")).toBe(unmanagedConfig);

    for (const tableHeader of [
      "  [shell_environment_policy] # valid TOML",
      '[ "shell_environment_policy" ]',
      "['shell_environment_policy'] # valid TOML",
    ]) {
      const formattedHome = temporaryDirectory("codex-cloud-formatted-");
      mkdirSync(path.join(formattedHome, ".codex"), { recursive: true });
      const formattedConfig = [
        tableHeader,
        'inherit = "all"',
        "exclude = []",
        "",
      ].join("\n");
      const formattedPath = path.join(formattedHome, ".codex/config.toml");
      writeFileSync(formattedPath, formattedConfig);
      const formatted = runSetupPolicyOnly(formattedHome, {
        CODEX_CLOUD_ACCESS_PROFILE: "offline",
      });
      expect(formatted.status).not.toBe(0);
      expect(formatted.stderr).toContain(
        "Unmanaged [shell_environment_policy] table found",
      );
      expect(readFileSync(formattedPath, "utf8")).toBe(formattedConfig);
    }

    for (const formattedConfig of [
      'shell_environment_policy.inherit = "all"\n',
      'shell_environment_policy = { inherit = "all", exclude = [] }\n',
    ]) {
      const formattedHome = temporaryDirectory("codex-cloud-formatted-");
      mkdirSync(path.join(formattedHome, ".codex"), { recursive: true });
      const formattedPath = path.join(formattedHome, ".codex/config.toml");
      writeFileSync(formattedPath, formattedConfig);
      const formatted = runSetupPolicyOnly(formattedHome, {
        CODEX_CLOUD_ACCESS_PROFILE: "offline",
      });
      expect(formatted.status).not.toBe(0);
      expect(formatted.stderr).toContain(
        "Unmanaged [shell_environment_policy] table found",
      );
      expect(readFileSync(formattedPath, "utf8")).toBe(formattedConfig);
    }

    const atomicHome = temporaryDirectory("codex-cloud-atomic-");
    mkdirSync(path.join(atomicHome, ".codex"), { recursive: true });
    const atomicConfig = ["[mcp_servers.keep]", 'command = "echo"', ""].join(
      "\n",
    );
    const atomicPath = path.join(atomicHome, ".codex/config.toml");
    writeFileSync(atomicPath, atomicConfig);
    const atomic = runSetupPolicyOnly(atomicHome, {
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
      CODEX_CLOUD_SETUP_TEST_FAIL_ATOMIC_WRITE: "1",
    });
    expect(atomic.status).not.toBe(0);
    expect(readFileSync(atomicPath, "utf8")).toBe(atomicConfig);
    expect(
      readdirSync(path.dirname(atomicPath)).filter((name) =>
        name.startsWith(".config.toml."),
      ),
    ).toEqual([]);

    const incompleteHome = temporaryDirectory("codex-cloud-incomplete-");
    mkdirSync(path.join(incompleteHome, ".codex"), { recursive: true });
    const incompleteConfig = [
      "[mcp_servers.keep]",
      'command = "echo"',
      "",
      "# BEGIN clinical-kb-codex-cloud shell policy (managed by setup-codex-cloud.sh)",
      "[shell_environment_policy]",
      'inherit = "all"',
      "",
    ].join("\n");
    const incompletePath = path.join(incompleteHome, ".codex/config.toml");
    writeFileSync(incompletePath, incompleteConfig);
    const incomplete = runSetupPolicyOnly(incompleteHome, {
      CODEX_CLOUD_ACCESS_PROFILE: "offline",
    });
    expect(incomplete.status).not.toBe(0);
    expect(incomplete.stderr).toContain(
      "Incomplete managed shell policy block",
    );
    expect(readFileSync(incompletePath, "utf8")).toBe(incompleteConfig);
  });

  it("accepts a task-only HEAD only inside Codex Cloud", () => {
    const directory = temporaryGitRepository();
    const commit = git(
      directory,
      "-c",
      "user.name=Codex",
      "-c",
      "user.email=codex@example.test",
      "commit",
      "--allow-empty",
      "-m",
      "task",
    );
    expect(commit.status, commit.stderr).toBe(0);

    expect(localGitBaseline(directory, {})).toBeNull();
    expect(localGitBaseline(directory, { CODEX_CLOUD: "1" })).toBe("HEAD");
  });

  it("launches and closes every installed Playwright browser", async () => {
    let closeCount = 0;
    const browserType = {
      executablePath: () => process.execPath,
      launch: async (options: { headless: boolean; timeout: number }) => {
        expect(options).toEqual({ headless: true, timeout: 1234 });
        return { close: async () => void (closeCount += 1) };
      },
    };
    expect(
      await playwrightBrowserErrors(
        { chromium: browserType, firefox: browserType, webkit: browserType },
        1234,
      ),
    ).toEqual([]);
    expect(closeCount).toBe(3);
  });

  it("does not describe a source-only runtime as fully browser-ready", () => {
    expect(
      codexCloudValidationScope({
        runtime: true,
        environment: true,
        browserInstallSkipped: true,
      }),
    ).toBe(
      "static, environment, and source-only runtime (browser validation skipped)",
    );
    expect(
      codexCloudValidationScope({
        runtime: true,
        environment: true,
        browserInstallSkipped: false,
      }),
    ).toBe("static, environment, and runtime");
  });

  it("distinguishes executable files from missing paths", () => {
    expect(executableFile(process.execPath)).toBe(true);
    expect(executableFile("/definitely/not/a/cloud/executable")).toBe(false);
  });

  it("verifies every Python worker import through the configured environment", () => {
    let invocation: string[] = [];
    const run = (command: string, args: string[]) => {
      invocation = [command, ...args];
      return { status: 0 };
    };

    expect(
      pythonWorkerImportError(process.execPath, run as typeof spawnSync),
    ).toBeNull();
    expect(invocation).toEqual([
      process.execPath,
      "-c",
      `import ${pythonWorkerImports.join(", ")}`,
    ]);
    expect(
      pythonWorkerImportError(process.execPath, (() => ({
        status: 1,
      })) as unknown as typeof spawnSync),
    ).toContain("Python worker imports failed");
  });
});

describe("Codex Cloud origin repair", () => {
  // Assert the configured URL (`git config --get`), not `git remote get-url`.
  // Environments with global `url.*.insteadOf` token rewrites (Cursor Cloud)
  // expand get-url to a credential-bearing form even when origin itself is clean.
  const configuredOriginUrl = (directory: string) =>
    git(directory, "config", "--get", "remote.origin.url").stdout.trim();

  it("adds the credential-free origin once, then preserves it", () => {
    const directory = temporaryGitRepository();
    expect(ensureOriginRemote(directory).action).toBe("added");
    expect(ensureOriginRemote(directory).action).toBe("preserved");
    expect(configuredOriginUrl(directory)).toBe(CODEX_CLOUD_ORIGIN_URL);
    expect(inspectOriginRemote(directory)).toEqual({
      configured: true,
      repositoryMatch: true,
      credentialsEmbedded: false,
    });
  });

  it("never overwrites a wrong or credential-bearing origin", () => {
    const wrong = temporaryGitRepository();
    expect(
      git(
        wrong,
        "remote",
        "add",
        "origin",
        "https://github.com/example/other.git",
      ).status,
    ).toBe(0);
    expect(() => ensureOriginRemote(wrong)).toThrow(/refusing to overwrite/);
    expect(configuredOriginUrl(wrong)).toBe(
      "https://github.com/example/other.git",
    );

    const credentialed = temporaryGitRepository();
    const unsafe = "https://token-value@github.com/BigSimmo/Database.git";
    expect(git(credentialed, "remote", "add", "origin", unsafe).status).toBe(0);
    expect(() => ensureOriginRemote(credentialed)).toThrow(
      /embedded credentials/,
    );
    expect(configuredOriginUrl(credentialed)).toBe(unsafe);
  });
});
