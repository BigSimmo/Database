import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  configuredProviderCredentialNames,
  executableFile,
  obsoleteNpmProxyVariables,
  parseMcpServerMetadata,
  providerCredentialVariables,
  pythonWorkerImportError,
  pythonWorkerImports,
  railwayReadCapability,
  sanitizedCloudCapabilityLines,
  validateCodexCloudEnvironment,
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
  expect(spawnSync("git", ["init", "--quiet", directory]).status).toBe(0);
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
        mcpServers: [{ name: "railway", command: "npx", environmentNames: ["RAILWAY_API_TOKEN"] }],
      },
    );
    const report = lines.join("\n");
    expect(report).toContain("OPENAI_API_KEY.present=true");
    expect(report).toContain("mcp.server=railway command=npx environment_names=RAILWAY_API_TOKEN");
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

  it("parses MCP server names, commands, and environment names without values", () => {
    const secret = "never-print-mcp-value";
    const metadata = parseMcpServerMetadata(
      JSON.stringify({ mcpServers: { railway: { command: "npx", env: { RAILWAY_API_TOKEN: secret } } } }),
    );
    expect(metadata).toEqual([{ name: "railway", command: "npx", environmentNames: ["RAILWAY_API_TOKEN"] }]);
    expect(JSON.stringify(metadata)).not.toContain(secret);
  });

  it("keeps setup and maintenance repairs guarded for repeat execution", () => {
    const setup = readFileSync(new URL("../scripts/setup-codex-cloud.sh", import.meta.url), "utf8");
    const maintenance = readFileSync(new URL("../scripts/maintain-codex-cloud.sh", import.meta.url), "utf8");
    expect(setup).toContain("if ! grep -Fq '.clinical-kb-codex-cloud.sh'");
    expect(setup).toContain('if [[ "$actual_version" != "$expected_version" ]]');
    expect(setup).toContain('"$HOME/.bash_profile"');
    expect(maintenance).toContain("ensure-codex-cloud-git-remote.mjs");
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
  it("adds the credential-free origin once, then preserves it", () => {
    const directory = temporaryGitRepository();
    expect(ensureOriginRemote(directory).action).toBe("added");
    expect(ensureOriginRemote(directory).action).toBe("preserved");
    expect(git(directory, "remote", "get-url", "origin").stdout.trim()).toBe(CODEX_CLOUD_ORIGIN_URL);
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
    expect(git(wrong, "remote", "get-url", "origin").stdout.trim()).toBe("https://github.com/example/other.git");

    const credentialed = temporaryGitRepository();
    const unsafe = "https://token-value@github.com/BigSimmo/Database.git";
    expect(git(credentialed, "remote", "add", "origin", unsafe).status).toBe(0);
    expect(() => ensureOriginRemote(credentialed)).toThrow(/embedded credentials/);
    expect(git(credentialed, "remote", "get-url", "origin").stdout.trim()).toBe(unsafe);
  });
});
