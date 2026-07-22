import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { childProcessExitCode, childProcessFailureSummary } from "../scripts/child-process-result.mjs";
import {
  offlineTestEnvironment,
  offlineUrlValues,
  providerEnvironmentKeys,
  requireProviderTestPermission,
} from "../scripts/test-environment.mjs";
import { acquireHeavyRunLock } from "../scripts/test-run-lock.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

describe("child process results", () => {
  it("never treats a missing status, signal, or launch error as success", () => {
    expect(childProcessExitCode({ status: null, signal: "SIGTERM" })).toBe(1);
    expect(childProcessExitCode({ status: null, signal: null })).toBe(1);
    expect(childProcessExitCode({ status: null, error: new Error("launch failed") })).toBe(1);
    expect(childProcessExitCode({ status: 0 })).toBe(0);
    expect(childProcessExitCode({ status: 7 })).toBe(7);
    expect(childProcessFailureSummary({ status: null, signal: "SIGTERM" })).toBe("missing exit status, signal SIGTERM");
  });

  it("maps a real missing executable launch to failure", () => {
    const result = spawnSync(`clinical-kb-missing-command-${Date.now()}`, []);
    expect(result.error).toBeTruthy();
    expect(childProcessExitCode(result)).toBe(1);
  });
});

describe("repository-wide heavyweight lock", () => {
  it("uses a workspace-local identity only when a packaged build context has no Git metadata", () => {
    const projectRoot = temporaryDirectory("clinical-kb-no-git-");
    const baseDirectory = temporaryDirectory("clinical-kb-no-git-lock-");
    writeFileSync(
      path.join(projectRoot, "package.json"),
      JSON.stringify({ name: "prompt-for-codex-medical-knowledge-base" }),
    );

    const lock = acquireHeavyRunLock({ projectRoot, baseDirectory, environment: {}, command: "docker build" });
    const expectedIdentity = path.resolve(projectRoot);
    expect(lock.owner.repositoryIdentity).toBe(
      process.platform === "win32" ? expectedIdentity.toLowerCase() : expectedIdentity,
    );
    lock.release();
  });

  it("blocks another worktree but permits a nested child with the owner token", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const first = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "first",
    });

    expect(() =>
      acquireHeavyRunLock({
        projectRoot: path.join(baseDirectory, "worktree-b"),
        repositoryIdentity,
        baseDirectory,
        environment: {},
        command: "second",
      }),
    ).toThrow(/Another Database heavyweight command is active/);

    const nested = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-b"),
      repositoryIdentity,
      baseDirectory,
      environment: first.environment,
      command: "nested",
    });
    expect(nested.reentrant).toBe(true);
    nested.release();
    first.release();
  });

  it("recovers a dead owner without allowing the old token to release the replacement", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-stale-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const stale = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      processId: 2_147_483_647,
      command: "dead",
    });
    const replacement = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-b"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "replacement",
    });

    stale.release();
    expect(readFileSync(path.join(replacement.path, "owner.json"), "utf8")).toContain(replacement.owner.token);
    replacement.release();
  });
});

describe("provider-safe test environment", () => {
  it("removes provider credentials and explicit live-test permission", () => {
    const source = Object.fromEntries(providerEnvironmentKeys.map((key) => [key, `secret-${key}`]));
    const environment: Record<string, string | undefined> = offlineTestEnvironment({
      ...source,
      SAFE_VALUE: "kept",
    });

    expect(environment).toMatchObject({
      SAFE_VALUE: "kept",
      RAG_PROVIDER_MODE: "offline",
      NEXT_PUBLIC_DEMO_MODE: "true",
    });
    for (const key of providerEnvironmentKeys) {
      expect(environment[key]).toBe(offlineUrlValues[key as keyof typeof offlineUrlValues] ?? "");
    }
  });

  it("requires explicit permission before live tests can run", () => {
    expect(() => requireProviderTestPermission({})).toThrow(/ALLOW_PROVIDER_TESTS=true/);
    expect(() => requireProviderTestPermission({ ALLOW_PROVIDER_TESTS: "true" })).not.toThrow();
  });

  it("keeps live tests out of default Vitest discovery", () => {
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(config).toContain('exclude: liveProviderTests ? [] : ["tests/**/*.live.test.ts"]');
  });

  it("keeps residual source surfaces visible without lowering the core coverage floor", () => {
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    for (const pattern of [
      '"src/**/*.{ts,tsx}"',
      '"scripts/**/*.{ts,mjs,cjs}"',
      '"worker/**/*.ts"',
      '"supabase/functions/**/*.ts"',
    ]) {
      expect(config).toContain(pattern);
    }
    expect(config).toContain('"src/{lib/**/*.ts,app/**/route.ts,components/**/*.{ts,tsx}}"');
    expect(config).not.toContain('"src/app/**/{page,layout,loading,error,not-found}.tsx"');
    expect(config).not.toContain('"src/**/*mockup*"');
  });

  it("refuses the live-test command before collection when permission is absent", () => {
    const result = spawnSync(process.execPath, ["scripts/run-live-tests.mjs"], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
      env: { ...process.env, ALLOW_PROVIDER_TESTS: "" },
      encoding: "utf8",
    });
    expect(childProcessExitCode(result)).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("Live provider tests are disabled");
  });

  it("loads Next environment files before checking live-test permission", () => {
    const runner = readFileSync(new URL("../scripts/run-live-tests.mjs", import.meta.url), "utf8");
    expect(runner).toContain('import nextEnv from "@next/env";');
    expect(runner).toContain("const { loadEnvConfig } = nextEnv;");
    expect(runner.indexOf("loadEnvConfig(projectRoot);")).toBeGreaterThanOrEqual(0);
    expect(runner.indexOf("loadEnvConfig(projectRoot);")).toBeLessThan(
      runner.indexOf("requireProviderTestPermission();"),
    );
  });

  it("fails focused selection closed for a deleted or missing explicit source path", () => {
    const result = spawnSync(process.execPath, ["scripts/test-focused.mjs", "--files", "src/missing-source.ts"], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
      encoding: "utf8",
    });
    expect(childProcessExitCode(result)).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain("deleted or missing paths require the full suite");
  });

  it("builds and starts an isolated production server for Playwright", () => {
    const runner = readFileSync(new URL("../scripts/run-playwright.mjs", import.meta.url), "utf8");
    const baseUrl = readFileSync(new URL("../scripts/playwright-base-url.ts", import.meta.url), "utf8");
    const ragRunner = readFileSync(new URL("../scripts/eval-rag-offline.mjs", import.meta.url), "utf8");
    const playwrightConfig = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(runner).toContain('["--max-old-space-size=8192", nextBin, "build", "--webpack"]');
    expect(runner).toContain('[nextBin, "start", "--hostname"');
    expect(runner).not.toContain('[nextBin, "dev", "--hostname"');
    expect(runner).toContain('NODE_ENV: "production"');
    expect(runner).toContain('PLAYWRIGHT_OFFLINE_MODE: "true"');
    expect(runner).toContain('NEXT_PUBLIC_MOCKUPS_ENABLED: mockupProjectRequested ? "true" : "false"');
    expect(runner).toContain("!explicitProjectRequested ||");
    // Empty 3xx bodies from legacy redirect route handlers must not fail readiness.
    expect(runner).toContain("body === null || body.includes(missingErrorComponentsNeedle)");
    expect(runner).not.toContain("if (!body || body.includes(missingErrorComponentsNeedle))");
    expect(runner).not.toContain("supabase.co");
    expect(packageJson.scripts["test:e2e:pr"]).toContain('--grep-invert "@quarantine|@mockup"');
    expect(packageJson.scripts["test:e2e:regression"]).toContain('--grep-invert "@critical|@quarantine|@mockup"');
    expect(baseUrl.indexOf("if (!allowEnsure)")).toBeLessThan(baseUrl.indexOf("findExistingLocalProjectUrl();"));
    expect(ragRunner).toContain("cwd: projectRoot");
    expect(playwrightConfig).toContain("visual-artifacts");
  });

  it("uses webpack when shared worktree dependencies resolve outside the project", () => {
    const devRunner = readFileSync(new URL("../scripts/dev-free-port.mjs", import.meta.url), "utf8");
    expect(devRunner).toContain('fs.realpathSync(path.join(projectRoot, "node_modules"))');
    expect(devRunner).toContain('return dependenciesAreExternal ? ["--webpack"] : [];');
    expect(devRunner).toContain('args.some((arg) => ["--webpack", "--turbopack", "--turbo"].includes(arg))');
  });
});
