import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  criticalInstalledPackages,
  installedLockParity,
  installedTreeParity,
  writeInstalledTreeStamp,
} from "../scripts/check-installed-lock-parity.mjs";

const temporaryRoots: string[] = [];
const requireFromTest = createRequire(import.meta.url);

function fixture(lockedVersion: string, installedVersion?: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "installed-lock-parity-"));
  temporaryRoots.push(root);
  writeFileSync(
    path.join(root, "package-lock.json"),
    JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/next": { version: lockedVersion } } }),
  );
  if (installedVersion) {
    mkdirSync(path.join(root, "node_modules", "next"), { recursive: true });
    writeFileSync(
      path.join(root, "node_modules", "next", "package.json"),
      JSON.stringify({ version: installedVersion }),
    );
  }
  return root;
}

function treeFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "installed-tree-parity-"));
  temporaryRoots.push(root);
  const packages = {
    "node_modules/direct": { version: "1.0.0" },
    "node_modules/direct/node_modules/transitive": { version: "2.0.0" },
  };
  writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  for (const [packagePath, entry] of Object.entries(packages)) {
    const packageRoot = path.join(root, ...packagePath.split("/"));
    mkdirSync(path.join(packageRoot, "types", "internal"), { recursive: true });
    writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ version: entry.version }));
    writeFileSync(path.join(packageRoot, "types", "index.d.ts"), "export type Public = string;\n");
    writeFileSync(path.join(packageRoot, "types", "internal", "detail.d.ts"), "export type Detail = number;\n");
  }
  mkdirSync(path.join(root, "node_modules"), { recursive: true });
  writeFileSync(
    path.join(root, "node_modules", ".package-lock.json"),
    JSON.stringify({ lockfileVersion: 3, packages }),
  );
  writeInstalledTreeStamp(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("installedLockParity", () => {
  it("covers the local validation toolchain as well as runtime packages", () => {
    expect(criticalInstalledPackages).toEqual(expect.arrayContaining(["eslint", "playwright", "typescript", "vitest"]));
  });

  it("accepts an installed package that exactly matches the lockfile", () => {
    expect(installedLockParity(fixture("16.2.11", "16.2.11"), ["next"])).toEqual([
      expect.objectContaining({ packageName: "next", lockedVersion: "16.2.11", installedVersion: "16.2.11", ok: true }),
    ]);
  });

  it("reports version drift before test output can be trusted", () => {
    expect(installedLockParity(fixture("16.2.11", "16.2.10"), ["next"])[0]).toEqual(
      expect.objectContaining({ ok: false, reason: "installed 16.2.10 does not match locked 16.2.11" }),
    );
  });

  it("fails closed when node_modules is absent", () => {
    expect(installedLockParity(fixture("16.2.11"), ["next"])[0]).toEqual(
      expect.objectContaining({ ok: false, installedVersion: null }),
    );
  });

  it("validates nested transitive versions against the exact lock location", () => {
    const root = treeFixture();
    const transitivePackage = path.join(root, "node_modules", "direct", "node_modules", "transitive", "package.json");
    writeFileSync(transitivePackage, JSON.stringify({ version: "1.9.0" }));

    expect(installedTreeParity(root)).toEqual(
      expect.objectContaining({ ok: false, reason: "1 installed package location(s) do not match" }),
    );
  });

  it("rejects an incomplete install when a non-entry package file is deleted", () => {
    const root = treeFixture();
    rmSync(path.join(root, "node_modules", "direct", "node_modules", "transitive", "types", "internal", "detail.d.ts"));

    expect(installedTreeParity(root)).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "installed file inventory differs from the trusted post-install stamp",
      }),
    );
  });

  it("rejects a zero-byte declaration while package entry points remain intact", () => {
    const root = treeFixture();
    writeFileSync(
      path.join(root, "node_modules", "direct", "node_modules", "transitive", "types", "internal", "detail.d.ts"),
      "",
    );

    expect(installedTreeParity(root)).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "installed file inventory differs from the trusted post-install stamp",
      }),
    );
  });

  it("ignores generated tool caches while retaining the package inventory", () => {
    const root = treeFixture();
    mkdirSync(path.join(root, "node_modules", ".cache", "eslint"), { recursive: true });
    mkdirSync(path.join(root, "node_modules", ".vite-temp"), { recursive: true });
    writeFileSync(path.join(root, "node_modules", ".cache", "eslint", "cache"), "generated");
    writeFileSync(path.join(root, "node_modules", ".vite-temp", "config.mjs"), "generated");

    expect(installedTreeParity(root)).toEqual(expect.objectContaining({ ok: true }));
  });

  it("runs before local, UI, release, and CI test interpretation", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const ci = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");

    for (const scriptName of ["verify:cheap:internal", "verify:ui", "verify:release"]) {
      const script = packageJson.scripts[scriptName];
      const parityIndex = script.indexOf("check:installed-lock-parity");
      const firstTestIndex = Math.min(
        ...["npm run lint", "npm run typecheck", "npm run test"]
          .map((command) => script.indexOf(command))
          .filter((index) => index >= 0),
      );
      expect(parityIndex, scriptName).toBeGreaterThan(-1);
      expect(parityIndex, scriptName).toBeLessThan(firstTestIndex);
    }
    expect(readFileSync(path.resolve("scripts/verify-pr-local.mjs"), "utf8")).toContain(
      '"check:runtime", "check:installed-lock-parity"',
    );
    expect(ci).toContain("run: npm run check:installed-lock-parity");
  });

  it("keeps brace-expansion on CVE-2026-14257-patched maintenance releases", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      overrides: Record<string, string>;
    };
    const lock = JSON.parse(readFileSync(path.resolve("package-lock.json"), "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    const expand = requireFromTest("brace-expansion") as (
      input: string,
      options?: { max?: number; maxLength?: number },
    ) => string[];

    expect(packageJson.overrides).toMatchObject({
      "brace-expansion@1": "^1.1.18",
      "brace-expansion@2": "^2.1.4",
      "brace-expansion@5": "^5.0.9",
    });
    expect(lock.packages["node_modules/brace-expansion"]?.version).toBe("1.1.18");
    expect(
      Object.entries(lock.packages)
        .filter(([name]) => name.endsWith("node_modules/brace-expansion"))
        .map(([, entry]) => entry.version),
    ).toEqual(expect.arrayContaining(["1.1.18", "5.0.9"]));

    const maxLength = 40_000;
    const adversarial = expand("{a,b}".repeat(100), { max: 100_000, maxLength });
    expect(adversarial.reduce((total, value) => total + value.length, 0)).toBeLessThanOrEqual(maxLength);
    expect(expand("a{b,c}d")).toEqual(["abd", "acd"]);
  });
});
