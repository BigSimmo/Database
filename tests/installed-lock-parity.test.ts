import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { criticalInstalledPackages, installedLockParity } from "../scripts/check-installed-lock-parity.mjs";

const temporaryRoots: string[] = [];

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

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
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
});
