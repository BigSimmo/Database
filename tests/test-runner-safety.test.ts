import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { childProcessExitCode, childProcessFailureSummary } from "../scripts/child-process-result.mjs";
import {
  offlineTestEnvironment,
  offlineUrlValues,
  providerEnvironmentKeys,
  requireProviderTestPermission,
} from "../scripts/test-environment.mjs";
import { acquireHeavyRunLock, testRunLockInternals } from "../scripts/test-run-lock.mjs";
import { typescriptBuildInfoPath, vitestCacheDirectory } from "../scripts/test-cache-path.mjs";
import { vitestLeaseMode } from "../scripts/test-run-selection.mjs";
import { redactSensitiveText } from "../scripts/sensitive-text.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function requireLeasePath(lease: { path?: string }) {
  if (!lease.path) throw new Error("Expected an acquired test lease to have a path");
  return lease.path;
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for coordinator test condition");
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
  it("lets exclusive work queue through long browser or build leases without making focused runs wait indefinitely", () => {
    expect(testRunLockInternals.defaultWaitTimeoutFor("shared")).toBe(30_000);
    expect(testRunLockInternals.defaultWaitTimeoutFor("exclusive")).toBe(15 * 60_000);
  });

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

  it("waits for a newly-created ownerless coordinator root instead of entering partial state", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-initializing-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const lockPath = testRunLockInternals.lockPathFor(repositoryIdentity, baseDirectory);
    mkdirSync(lockPath, { recursive: true });

    expect(() =>
      acquireHeavyRunLock({
        projectRoot: path.join(baseDirectory, "worktree-a"),
        repositoryIdentity,
        baseDirectory,
        environment: {},
        command: "focused-a",
        mode: "shared",
        waitTimeoutMs: 0,
      }),
    ).toThrow(/coordinator is being initialized/);
  });

  it("does not bypass a live legacy single-owner lock", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-legacy-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const lockPath = testRunLockInternals.lockPathFor(repositoryIdentity, baseDirectory);
    const legacyOwner = {
      pid: process.pid,
      token: "legacy-owner",
      command: "legacy full suite",
      worktree: path.join(baseDirectory, "legacy-worktree"),
      repositoryIdentity,
      startedAt: new Date().toISOString(),
    };
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(path.join(lockPath, "owner.json"), `${JSON.stringify(legacyOwner, null, 2)}\n`, "utf8");

    expect(() =>
      acquireHeavyRunLock({
        projectRoot: path.join(baseDirectory, "worktree-a"),
        repositoryIdentity,
        baseDirectory,
        environment: {},
        command: "focused-a",
        mode: "shared",
        waitTimeoutMs: 0,
      }),
    ).toThrow(/focused-test capacity is full/);
    expect(readFileSync(path.join(lockPath, "owner.json"), "utf8")).toContain("legacy-owner");
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
        waitTimeoutMs: 0,
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

  it("admits two focused leases from different worktrees while keeping heavyweight work exclusive", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-shared-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const first = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "focused-a",
      mode: "shared",
    });
    const second = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-b"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "focused-b",
      mode: "shared",
    });

    try {
      expect(first.owner.mode).toBe("shared");
      expect(second.owner.mode).toBe("shared");
      expect(first.path).not.toBe(second.path);
      const sentinel = JSON.parse(readFileSync(path.join(first.coordinatorPath, "owner.json"), "utf8")) as {
        pid: number;
        holderPid: number;
        coordinator: boolean;
      };
      expect(sentinel.coordinator).toBe(true);
      expect(sentinel.holderPid).toBe(process.pid);
      expect(testRunLockInternals.processIsAlive(sentinel.pid)).toBe(true);
      expect(() =>
        acquireHeavyRunLock({
          projectRoot: path.join(baseDirectory, "worktree-c"),
          repositoryIdentity,
          baseDirectory,
          environment: {},
          command: "focused-c",
          mode: "shared",
          waitTimeoutMs: 0,
        }),
      ).toThrow(/focused-test capacity is full/);
      expect(() =>
        acquireHeavyRunLock({
          projectRoot: path.join(baseDirectory, "worktree-c"),
          repositoryIdentity,
          baseDirectory,
          environment: {},
          command: "full-suite",
          waitTimeoutMs: 0,
        }),
      ).toThrow(/Another Database heavyweight command is active/);

      const nested = acquireHeavyRunLock({
        projectRoot: path.join(baseDirectory, "worktree-b"),
        repositoryIdentity,
        baseDirectory,
        environment: second.environment,
        command: "nested",
        mode: "shared",
      });
      expect(nested.reentrant).toBe(true);

      first.release();
      const replacement = acquireHeavyRunLock({
        projectRoot: path.join(baseDirectory, "worktree-c"),
        repositoryIdentity,
        baseDirectory,
        environment: {},
        command: "focused-c",
        mode: "shared",
        waitTimeoutMs: 0,
      });
      replacement.release();
    } finally {
      first.release();
      second.release();
    }
  });

  it("does not admit overlapping focused runs from the same worktree", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-same-worktree-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const projectRoot = path.join(baseDirectory, "worktree-a");
    const first = acquireHeavyRunLock({
      projectRoot,
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "focused-a",
      mode: "shared",
    });
    try {
      expect(() =>
        acquireHeavyRunLock({
          projectRoot,
          repositoryIdentity,
          baseDirectory,
          environment: {},
          command: "focused-a-second",
          mode: "shared",
          waitTimeoutMs: 0,
        }),
      ).toThrow(/focused-test capacity is full/);
    } finally {
      first.release();
    }
  });

  it("gives a queued heavyweight process priority over later focused work", async () => {
    const baseDirectory = temporaryDirectory("clinical-kb-fair-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const first = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "focused-a",
      mode: "shared",
    });
    const lockModuleUrl = new URL("../scripts/test-run-lock.mjs", import.meta.url).href;
    const childSource = `
      import path from "node:path";
      import { acquireHeavyRunLock } from ${JSON.stringify(lockModuleUrl)};
      const lock = acquireHeavyRunLock({
        projectRoot: path.join(process.env.COORDINATOR_TEST_BASE, "worktree-exclusive"),
        repositoryIdentity: process.env.COORDINATOR_TEST_IDENTITY,
        baseDirectory: process.env.COORDINATOR_TEST_BASE,
        environment: {},
        command: "full-suite",
        waitTimeoutMs: 5000,
      });
      console.log("exclusive-acquired");
      await new Promise((resolve) => setTimeout(resolve, 50));
      lock.release();
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", childSource], {
      env: {
        ...process.env,
        COORDINATOR_TEST_BASE: baseDirectory,
        COORDINATOR_TEST_IDENTITY: repositoryIdentity,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    const childResult = new Promise<number>((resolve) => child.on("close", (status) => resolve(status ?? 1)));

    try {
      const queueDirectory = testRunLockInternals.coordinatorPaths(first.coordinatorPath).queue;
      await waitForCondition(() =>
        readdirSync(queueDirectory).some((file) => {
          const ticket = JSON.parse(readFileSync(path.join(queueDirectory, file), "utf8")) as { mode: string };
          return ticket.mode === "exclusive";
        }),
      );
      expect(() =>
        acquireHeavyRunLock({
          projectRoot: path.join(baseDirectory, "worktree-b"),
          repositoryIdentity,
          baseDirectory,
          environment: {},
          command: "focused-b",
          mode: "shared",
          waitTimeoutMs: 0,
        }),
      ).toThrow(/focused-test capacity is full/);
    } finally {
      first.release();
    }

    expect(await childResult, stderr).toBe(0);
    expect(stdout).toContain("exclusive-acquired");
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
    expect(readFileSync(path.join(requireLeasePath(replacement), "owner.json"), "utf8")).toContain(
      replacement.owner.token,
    );
    replacement.release();
  });

  it("allows an explicit force-lock-release to replace a live owner", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-force-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const first = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "first",
    });

    const replacement = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-b"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: "replacement",
      forceLockRelease: true,
    });

    expect(replacement.owner.token).not.toBe(first.owner.token);
    expect(readFileSync(path.join(requireLeasePath(replacement), "owner.json"), "utf8")).toContain(
      replacement.owner.token,
    );
    first.release();
    replacement.release();
  });

  it("keeps a live owner's lock even when startedAt is older than five minutes", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-live-old-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const first = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      processId: process.pid,
      command: "long-running",
    });

    try {
      const ownerPath = path.join(requireLeasePath(first), "owner.json");
      const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as {
        pid: number;
        token: string;
        command: string;
        worktree: string;
        repositoryIdentity: string;
        startedAt: string;
      };
      owner.startedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      writeFileSync(ownerPath, `${JSON.stringify(owner, null, 2)}\n`, "utf8");

      expect(() =>
        acquireHeavyRunLock({
          projectRoot: path.join(baseDirectory, "worktree-b"),
          repositoryIdentity,
          baseDirectory,
          environment: {},
          command: "second",
          waitTimeoutMs: 0,
        }),
      ).toThrow(/Another Database heavyweight command is active/);

      const retained = JSON.parse(readFileSync(ownerPath, "utf8")) as { token: string; pid: number };
      expect(retained.token).toBe(first.owner.token);
      expect(retained.pid).toBe(process.pid);
    } finally {
      first.release();
    }
  });

  it("never persists or repeats credentials embedded in a command", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-secret-lock-");
    const repositoryIdentity = path.join(baseDirectory, "shared.git");
    const exposed = ["crsr", "example_worker_credential_123456789"].join("_");
    const openAiExample = ["sk", "example-secret-123456"].join("-");
    const first = acquireHeavyRunLock({
      projectRoot: path.join(baseDirectory, "worktree-a"),
      repositoryIdentity,
      baseDirectory,
      environment: {},
      command: `worker --api-key ${exposed} OPENAI_API_KEY=${openAiExample}`,
    });

    try {
      const ownerText = readFileSync(path.join(requireLeasePath(first), "owner.json"), "utf8");
      expect(ownerText).not.toContain(exposed);
      expect(ownerText).not.toContain(openAiExample);
      expect(ownerText).toContain("[REDACTED]");
      expect(() =>
        acquireHeavyRunLock({
          projectRoot: path.join(baseDirectory, "worktree-b"),
          repositoryIdentity,
          baseDirectory,
          environment: {},
          command: "second",
          waitTimeoutMs: 0,
        }),
      ).toThrow(/\[REDACTED\]/);
    } finally {
      first.release();
    }
  });
});

describe("focused test admission", () => {
  it("shares only explicit focused selections and keeps broad or custom-worker runs exclusive", () => {
    expect(vitestLeaseMode(["related", "--run", "src/lib/example.ts"])).toBe("shared");
    expect(vitestLeaseMode(["run", "tests/example.test.ts", "--reporter=dot"])).toBe("shared");
    expect(vitestLeaseMode(["run", "tests/example.dom.test.tsx"])).toBe("shared");
    expect(vitestLeaseMode(["run", "--reporter=dot"])).toBe("exclusive");
    expect(vitestLeaseMode(["run", "tests/example.test.ts", "--coverage"])).toBe("exclusive");
    expect(vitestLeaseMode(["run", "tests/example.test.ts", "--coverage.enabled"])).toBe("exclusive");
    expect(vitestLeaseMode(["run", "tests/example.test.ts", "--maxWorkers=4"])).toBe("exclusive");
    expect(vitestLeaseMode(["run", "tests/example.test.ts", "--max-workers=4"])).toBe("exclusive");
    expect(vitestLeaseMode(["run", "tests/example.test.ts", "-c", "vitest.other.mts"])).toBe("exclusive");
  });

  it("uses different transform-cache directories for different worktrees", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-vitest-cache-");
    const first = vitestCacheDirectory(path.join(baseDirectory, "worktree-a"), baseDirectory);
    const second = vitestCacheDirectory(path.join(baseDirectory, "worktree-b"), baseDirectory);
    expect(first).not.toBe(second);
    expect(path.dirname(first)).toBe(path.join(baseDirectory, "clinical-kb-vitest-cache"));
  });

  it("uses different TypeScript incremental state for different worktrees", () => {
    const baseDirectory = temporaryDirectory("clinical-kb-tsc-cache-");
    const first = typescriptBuildInfoPath(path.join(baseDirectory, "worktree-a"), baseDirectory);
    const second = typescriptBuildInfoPath(path.join(baseDirectory, "worktree-b"), baseDirectory);
    expect(first).not.toBe(second);
    expect(path.dirname(path.dirname(first))).toBe(path.join(baseDirectory, "clinical-kb-tsc-cache"));
    expect(path.basename(first)).toBe("tsconfig.tsbuildinfo");
  });
});

describe("sensitive diagnostic text", () => {
  it("redacts CLI flags, environment assignments, bearer values, URLs, and JWTs", () => {
    const jwt = "eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop";
    const cursorExample = ["crsr", "example_1234567890"].join("_");
    const otherCursorExample = ["crsr", "other_1234567890"].join("_");
    const supabaseSecretExample = ["sb", "secret", "example_1234567890"].join("_");
    const value = [
      `agent --api-key ${cursorExample}`,
      `CURSOR_API_KEY=${otherCursorExample}`,
      `supabase --token ${supabaseSecretExample}`,
      "Authorization: Bearer bearer-value-123456",
      "https://worker:password-value@example.com/path",
      jwt,
    ].join(" ");
    const redacted = redactSensitiveText(value);

    expect(redacted).not.toContain(cursorExample);
    expect(redacted).not.toContain(otherCursorExample);
    expect(redacted).not.toContain(supabaseSecretExample);
    expect(redacted).not.toContain("bearer-value-123456");
    expect(redacted).not.toContain("password-value");
    expect(redacted).not.toContain(jwt);
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(6);
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

  it("loads credentials from Next environment files without accepting persisted permission", () => {
    const runner = readFileSync(new URL("../scripts/run-live-tests.mjs", import.meta.url), "utf8");
    const permissionSnapshot = "const providerTestPermission = process.env.ALLOW_PROVIDER_TESTS;";
    const permissionCheck = "requireProviderTestPermission({ ALLOW_PROVIDER_TESTS: providerTestPermission });";
    expect(runner).toContain('import nextEnv from "@next/env";');
    expect(runner).toContain("const { loadEnvConfig } = nextEnv;");
    expect(runner.indexOf(permissionSnapshot)).toBeGreaterThanOrEqual(0);
    expect(runner.indexOf(permissionSnapshot)).toBeLessThan(runner.indexOf("loadEnvConfig(projectRoot);"));
    expect(runner.indexOf("loadEnvConfig(projectRoot);")).toBeLessThan(runner.indexOf(permissionCheck));
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
    const preflight = readFileSync(new URL("../scripts/playwright-browser-preflight.mjs", import.meta.url), "utf8");
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
    // Missing browser binaries must fail before the heavy lock / production build (#120).
    expect(runner).toContain("assertPlaywrightBrowsersReady(playwrightArgs);");
    expect(runner.indexOf("assertPlaywrightBrowsersReady(playwrightArgs);")).toBeLessThan(
      runner.indexOf("lock = acquireHeavyRunLock("),
    );
    expect(runner.indexOf("assertPlaywrightBrowsersReady(playwrightArgs);")).toBeLessThan(
      runner.indexOf("console.log(`Building isolated production Playwright app"),
    );
    expect(preflight).toContain("chromium_headless_shell");
    expect(preflight).toContain("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH");
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
