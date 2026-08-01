import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  codexCloudValidationScope,
  configuredProviderCredentialNames,
  expectedMcpConfiguration,
  executableFile,
  localGitBaseline,
  obsoleteNpmProxyVariables,
  parseMcpServerMetadata,
  providerCredentialVariables,
  pythonWorkerImportError,
  pythonWorkerImports,
  railwayReadCapability,
  sanitizedCloudCapabilityLines,
  validateCodexCloudEnvironment,
  validateMcpConfiguration,
} from "../scripts/check-codex-cloud-setup.mjs";
import { providerEnvironmentKeys } from "../scripts/test-environment.mjs";
import {
  CODEX_CLOUD_ORIGIN_URL,
  ensureOriginRemote,
  inspectOriginRemote,
} from "../scripts/ensure-codex-cloud-git-remote.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryGitRepository() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "codex-cloud-git-"));
  temporaryDirectories.push(directory);
  expect(spawnSync("git", ["init", "--quiet", "--initial-branch=task", directory]).status).toBe(0);
  return directory;
}

function git(directory: string, ...args: string[]) {
  return spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
}

describe("Codex Cloud environment contract", () => {
  it("keeps the checked-in setup reproducible and provider-safe", () => {
    const staticEnvironment = { ...process.env };
    delete staticEnvironment.CODEX_CLOUD;
    const result = spawnSync(process.execPath, ["scripts/check-codex-cloud-setup.mjs"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      env: staticEnvironment,
      shell: false,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("[Codex Cloud Check] PASS: static Cloud contracts match.");
  });

  it("reports sensitive and proxy variable names without exposing values", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      OPENAI_API_KEY: "never-print-this",
      npm_config_https_proxy: "https://user:secret@example.test",
      HTTP_PROXY: "http://supported.example.test",
    };

    expect(configuredProviderCredentialNames(env)).toEqual(["OPENAI_API_KEY"]);
    expect(obsoleteNpmProxyVariables(env)).toEqual(["npm_config_https_proxy"]);
  });

  it("covers every provider-capable test variable in the Cloud credential inventory", () => {
    for (const key of providerEnvironmentKeys) expect(providerCredentialVariables).toContain(key);
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
    expect(validateCodexCloudEnvironment({ ...offline, NEXT_PUBLIC_DEMO_MODE: "false" })).toContain(
      "NEXT_PUBLIC_DEMO_MODE must be true in offline mode.",
    );
    expect(
      validateCodexCloudEnvironment({
        ...offline,
        CODEX_CLOUD_ACCESS_PROFILE: "connected",
        RAG_PROVIDER_MODE: "auto",
        NEXT_PUBLIC_DEMO_MODE: "false",
        PLAYWRIGHT_OFFLINE_MODE: "false",
      }),
    ).toEqual([]);

    expect(
      validateCodexCloudEnvironment({
        ...offline,
        CODEX_CLOUD_ACCESS_PROFILE: "connected",
        RAG_PROVIDER_MODE: "offline",
        SUPABASE_ACCESS_TOKEN: "setup-only-secret",
      }),
    ).toContain("Connected mode exposes provider environment variables: SUPABASE_ACCESS_TOKEN.");
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
        origin: { configured: true, repositoryMatch: true, credentialsEmbedded: false },
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
    expect(report).toContain("mcp.server=railway type=http command=none endpoint=https://mcp.railway.com/");
    expect(report).not.toContain(secret);
    expect(report).not.toContain("sensitive-test");
  });

  it("requires the Railway CLI and dedicated account token without substituting a project token", () => {
    expect(railwayReadCapability({ RAILWAY_API_TOKEN: "configured" }, true).ready).toBe(true);
    expect(railwayReadCapability({ RAILWAY_TOKEN: "configured" }, true)).toMatchObject({
      dedicatedCredentialPresent: false,
      projectCredentialPresent: true,
      ready: false,
    });
    expect(railwayReadCapability({ RAILWAY_API_TOKEN: "configured" }, false).ready).toBe(false);
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
        railway: { type: "http", url: expectedMcpConfiguration.railwayUrl.replace(/\/$/, "") },
        supabase: {
          type: "http",
          url: `${expectedMcpConfiguration.supabaseUrl}?project_ref=${expectedMcpConfiguration.supabaseProjectRef}&read_only=true&features=${expectedMcpConfiguration.supabaseFeatures.join(",")}`,
        },
      },
    });
    expect(validateMcpConfiguration(valid)).toEqual([]);
    expect(validateMcpConfiguration(valid.replace("read_only=true", "read_only=false"))).toContain(
      "Supabase MCP must keep the production project read-only.",
    );
    expect(validateMcpConfiguration(valid.replace('"supabase":', '"unexpected":{},"supabase":'))).toContain(
      "Cloud MCP configuration must contain only Railway and Supabase.",
    );
    expect(validateMcpConfiguration(valid.replace('"railway":{"type"', '"railway":{"headers":{},"type"'))).toContain(
      "railway MCP must use hosted OAuth without embedded environment variables or headers.",
    );
    expect(validateMcpConfiguration(valid.replace("&read_only=true", "&read_only=true&token=forbidden"))).toContain(
      "Supabase MCP must not include additional query parameters.",
    );
  });

  it("keeps setup and maintenance repairs guarded for repeat execution", () => {
    const setup = readFileSync(new URL("../scripts/setup-codex-cloud.sh", import.meta.url), "utf8");
    const maintenance = readFileSync(new URL("../scripts/maintain-codex-cloud.sh", import.meta.url), "utf8");
    expect(setup).toContain("if ! grep -Fq '.clinical-kb-codex-cloud.sh'");
    expect(setup).toContain('if [[ "$actual_version" != "$expected_version" ]]');
    expect(setup).toContain('"$HOME/.bash_profile"');
    expect(setup.match(/unset npm_config_http_proxy npm_config_https_proxy npm_config_proxy/g)).toHaveLength(2);
    expect(setup.indexOf("unset OPENAI_API_KEY")).toBeLessThan(
      setup.indexOf('if [ "\\$CODEX_CLOUD_ACCESS_PROFILE" = "connected" ]'),
    );
    expect(maintenance).toContain("ensure-codex-cloud-git-remote.mjs");
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

  it("does not describe a source-only runtime as fully browser-ready", () => {
    expect(codexCloudValidationScope({ runtime: true, environment: true, browserInstallSkipped: true })).toBe(
      "static, environment, and source-only runtime (browser validation skipped)",
    );
    expect(codexCloudValidationScope({ runtime: true, environment: true, browserInstallSkipped: false })).toBe(
      "static, environment, and runtime",
    );
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

    expect(pythonWorkerImportError(process.execPath, run as typeof spawnSync)).toBeNull();
    expect(invocation).toEqual([process.execPath, "-c", `import ${pythonWorkerImports.join(", ")}`]);
    expect(pythonWorkerImportError(process.execPath, (() => ({ status: 1 })) as unknown as typeof spawnSync)).toContain(
      "Python worker imports failed",
    );
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
    expect(git(wrong, "remote", "add", "origin", "https://github.com/example/other.git").status).toBe(0);
    expect(() => ensureOriginRemote(wrong)).toThrow(/refusing to overwrite/);
    expect(configuredOriginUrl(wrong)).toBe("https://github.com/example/other.git");

    const credentialed = temporaryGitRepository();
    const unsafe = "https://token-value@github.com/BigSimmo/Database.git";
    expect(git(credentialed, "remote", "add", "origin", unsafe).status).toBe(0);
    expect(() => ensureOriginRemote(credentialed)).toThrow(/embedded credentials/);
    expect(configuredOriginUrl(credentialed)).toBe(unsafe);
  });
});
