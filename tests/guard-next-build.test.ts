import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEV_SERVER_BUILD_REFUSED_EXIT_CODE,
  discardDevServerTypes,
  evaluateNextBuildRamGuard,
  findRunningProjectServer,
} from "../scripts/guard-next-build.mjs";
import {
  appName,
  localProjectId,
  projectPortEnd,
  projectPortStart,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

const eightGiB = 8 * 1024 * 1024 * 1024;
const twelveGiB = 12 * 1024 * 1024 * 1024;

/** Partial env stub — avoids requiring full NodeJS.ProcessEnv (NODE_ENV). */
type RamGuardEnv = { CI?: string; GITHUB_ACTIONS?: string; ALLOW_LOW_RAM_BUILD?: string };

describe("evaluateNextBuildRamGuard", () => {
  it("allows hosts with at least 10 GiB total RAM", () => {
    const env: RamGuardEnv = {};
    expect(evaluateNextBuildRamGuard({ totalRamBytes: twelveGiB, env })).toBe("ok");
  });

  it("hard-fails low-RAM local/Docker Desktop hosts", () => {
    const env: RamGuardEnv = {};
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env })).toBe("fail");
  });

  it("warns instead of failing under CI or ALLOW_LOW_RAM_BUILD when RAM is under 10 GiB", () => {
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { CI: "true" } })).toBe("warn");
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { GITHUB_ACTIONS: "true" } })).toBe("warn");
    expect(evaluateNextBuildRamGuard({ totalRamBytes: eightGiB, env: { ALLOW_LOW_RAM_BUILD: "1" } })).toBe("warn");
  });
});

describe("DEV_SERVER_BUILD_REFUSED_EXIT_CODE", () => {
  it("uses a dedicated non-zero code so refused builds cannot look green (#167)", () => {
    expect(DEV_SERVER_BUILD_REFUSED_EXIT_CODE).toBe(76);
  });
});

describe("discardDevServerTypes", () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true, maxRetries: 5 });
  });

  function scratchRoot() {
    const root = mkdtempSync(path.join(tmpdir(), "guard-next-build-"));
    roots.push(root);
    return root;
  }

  it("removes a dev server's leftover output so a truncated validator cannot fail the build", () => {
    // A dev server stopped mid-write leaves `.next/dev/types/validator.ts` half
    // finished, and `next build` type-checks it: the build then fails on a
    // generated file nobody wrote. Observed on 2026-09-06, cost a full
    // verify:pr-local run.
    const root = scratchRoot();
    mkdirSync(path.join(root, ".next", "dev", "types"), { recursive: true });
    writeFileSync(path.join(root, ".next", "dev", "types", "validator.ts"), "export const truncated = {");

    discardDevServerTypes(root);

    expect(existsSync(path.join(root, ".next", "dev"))).toBe(false);
  });

  it("leaves production build output alone", () => {
    const root = scratchRoot();
    mkdirSync(path.join(root, ".next", "server"), { recursive: true });
    writeFileSync(path.join(root, ".next", "BUILD_ID"), "abc123");

    discardDevServerTypes(root);

    expect(existsSync(path.join(root, ".next", "server"))).toBe(true);
    expect(existsSync(path.join(root, ".next", "BUILD_ID"))).toBe(true);
  });

  it("is a no-op when there is nothing to discard", () => {
    const root = scratchRoot();
    expect(() => discardDevServerTypes(root)).not.toThrow();
  });
});

describe("findRunningProjectServer", () => {
  // `dev-free-port.mjs` honours any PORT or --port, so this checkout's dev server
  // can sit below its stable port. An upward-only scan never reached it, and the
  // guard then reported no server running — which both permitted a concurrent
  // production build and, once cleanup was added, cleared `.next/dev` from under a
  // live session.
  it("finds this project's dev server on a port below the stable one", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "guard-next-build-root-"));
    const stable = stableProjectPort(rootDir);
    const below = stable === projectPortStart ? projectPortEnd : stable - 1;

    const server = http.createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ appName, projectId: localProjectId(rootDir) }));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server.on("error", reject);
        server.listen(below, "127.0.0.1", resolve);
      });
    } catch {
      // The port is already taken on this machine; the scan order is what is under
      // test, and a colliding port cannot demonstrate it either way.
      server.close();
      rmSync(rootDir, { recursive: true, force: true, maxRetries: 5 });
      return;
    }

    try {
      await expect(findRunningProjectServer(rootDir)).resolves.toBe(below);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(rootDir, { recursive: true, force: true, maxRetries: 5 });
    }
  }, 60_000);
});
