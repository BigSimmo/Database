import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DS_SYNC_PACKAGES,
  dsSyncInstallCommand,
  dsSyncInstallSpecifiers,
  planBuildSteps,
} from "../scripts/design-sync.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repositoryRoot, "scripts", "design-sync.mjs");
const lock = JSON.parse(readFileSync(path.join(repositoryRoot, "package-lock.json"), "utf8")) as {
  packages: Record<string, { version: string }>;
};

// scripts/design-sync.mjs is the one script that installed unpinned packages and ran a
// config-supplied string through a shell. Both are now refused by construction.
describe("design-sync supply chain", () => {
  it("pins the toolchain to the repository's own versions where the lockfile has them", () => {
    expect(DS_SYNC_PACKAGES.esbuild).toBe(lock.packages["node_modules/esbuild"].version);
    expect(DS_SYNC_PACKAGES["@types/react"]).toBe(lock.packages["node_modules/@types/react"].version);
    expect(DS_SYNC_PACKAGES["@tailwindcss/cli"]).toBe(lock.packages["node_modules/tailwindcss"].version);
    for (const version of Object.values(DS_SYNC_PACKAGES)) {
      if (version !== null) expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("refuses to install an unpinned package unless --allow-unpinned is explicit", () => {
    const refused = dsSyncInstallSpecifiers({ esbuild: "0.28.2", geist: null });
    expect(refused.error).toContain("geist");
    expect(refused.specifiers).toBeUndefined();

    const allowed = dsSyncInstallSpecifiers({ esbuild: "0.28.2", geist: null }, { allowUnpinned: true });
    expect(allowed.specifiers).toEqual(["esbuild@0.28.2", "geist"]);
    expect(dsSyncInstallCommand(["esbuild@0.28.2"])).toEqual([
      "npm",
      "install",
      "--prefix",
      ".ds-sync",
      "--no-save",
      "--package-lock=false",
      "esbuild@0.28.2",
    ]);
  });

  it("parses the committed buildCmd into argv steps and a Node append, never a shell string", () => {
    const config = JSON.parse(readFileSync(path.join(repositoryRoot, ".design-sync", "config.json"), "utf8")) as {
      buildCmd: string;
    };
    const steps = planBuildSteps(config.buildCmd);
    expect(steps[0]).toMatchObject({ kind: "spawn" });
    expect((steps[0] as { argv: string[] }).argv[0]).toBe("node");
    expect(steps.at(-1)).toEqual({
      kind: "append",
      source: ".design-sync/font-vars.css",
      target: ".design-sync/.cache/compiled.css",
    });

    expect(() => planBuildSteps("node build.mjs; rm -rf /")).toThrow(/shell syntax/);
    expect(() => planBuildSteps("node build.mjs | tee out")).toThrow(/shell syntax/);
    expect(() => planBuildSteps("cat $(whoami) >> out.css")).toThrow(/shell syntax/);
    expect(() => planBuildSteps("")).toThrow(/empty/);
  });

  it("never hands a non-literal string to a shell", () => {
    const source = readFileSync(script, "utf8");
    expect(source).not.toMatch(/spawnSync\((?:buildCmd|withoutCat)/);
    expect(source).not.toContain("--no-save --package-lock=false ${");
  });

  it("does not contact the registry by default and says how to", () => {
    const output = execFileSync(process.execPath, [script, "--dry-run"], { cwd: repositoryRoot, encoding: "utf8" });
    expect(output).toContain("(skip) registry install — pass --install to run it");
    expect(output).not.toContain("npm install");

    let failure: { status?: number; stderr?: string } | null = null;
    try {
      execFileSync(process.execPath, [script, "--dry-run", "--install"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      failure = error as { status?: number; stderr?: string };
    }
    // Two packages are still unpinned, so even a dry-run install is refused until an
    // operator pins them or passes --allow-unpinned.
    expect(failure?.status).toBe(1);
    expect(failure?.stderr).toContain("refusing to install unpinned package(s)");
  });
});
