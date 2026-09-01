import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { writeInstalledTreeStamp } from "../scripts/check-installed-lock-parity.mjs";

import {
  findDependencyDonor,
  installationIsComplete,
  installedMetadataMatches,
  lockDigest,
  nodeVersionSatisfiesRange,
  parseWorktreeList,
  resolveNpmCli,
} from "../scripts/setup-codex-worktree.mjs";

const temporaryRoots: string[] = [];

function fixture(version = "1.0.0", complete = false) {
  const root = mkdtempSync(path.join(os.tmpdir(), "codex-worktree-setup-"));
  temporaryRoots.push(root);
  const packages = {
    "": { name: "fixture" },
    "node_modules/next": { version },
    "node_modules/react": { version: "19.2.8" },
  };
  writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  if (complete) {
    mkdirSync(path.join(root, "node_modules", "next"), { recursive: true });
    mkdirSync(path.join(root, "node_modules", "react"), { recursive: true });
    writeFileSync(path.join(root, "node_modules", "next", "package.json"), JSON.stringify({ version }));
    writeFileSync(path.join(root, "node_modules", "react", "package.json"), JSON.stringify({ version: "19.2.8" }));
    writeFileSync(
      path.join(root, "node_modules", ".package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "node_modules/next": { version },
          "node_modules/react": { version: "19.2.8" },
        },
      }),
    );
    writeInstalledTreeStamp(root);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("Codex Desktop worktree setup", () => {
  it("enforces the complete declared Node range before dependency handling", () => {
    const range = ">=26.0.0 <27";

    expect(nodeVersionSatisfiesRange("25.19.0", range)).toBe(false);
    expect(nodeVersionSatisfiesRange("26.0.0", range)).toBe(true);
    expect(nodeVersionSatisfiesRange("26.8.1", range)).toBe(true);
    expect(nodeVersionSatisfiesRange("27.0.0", range)).toBe(false);
    expect(nodeVersionSatisfiesRange("not-a-version", range)).toBe(false);
  });

  it("parses worktree paths without treating metadata as paths", () => {
    expect(parseWorktreeList("worktree C:/repo/main\nHEAD abc\n\nworktree C:/repo/feature\ndetached\n")).toEqual([
      path.resolve("C:/repo/main"),
      path.resolve("C:/repo/feature"),
    ]);
  });

  it("requires installed metadata and critical packages", () => {
    const incomplete = fixture("16.2.12");
    const complete = fixture("16.2.12", true);
    mkdirSync(path.join(incomplete, "node_modules"), { recursive: true });
    writeFileSync(
      path.join(incomplete, "node_modules", ".package-lock.json"),
      JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/next": { version: "16.2.12" } } }),
    );
    expect(installedMetadataMatches(incomplete)).toBe(false);
    expect(installationIsComplete(incomplete)).toBe(false);
    expect(installedMetadataMatches(complete)).toBe(true);
    expect(installationIsComplete(complete, ["next"])).toBe(true);
  });

  it("uses only a complete donor with a byte-identical lockfile", () => {
    const current = fixture("16.2.12");
    const wrongLock = fixture("16.2.11", true);
    const exactLock = fixture("16.2.12", true);

    expect(lockDigest(wrongLock)).not.toBe(lockDigest(current));
    expect(lockDigest(exactLock)).toBe(lockDigest(current));
    expect(findDependencyDonor([wrongLock, exactLock], current, ["next"])).toBe(exactLock);
  });

  it("resolves npm's JavaScript entrypoint without executing a Windows command shim", () => {
    const resolved = resolveNpmCli();
    expect(resolved === null || /npm-cli\.js$/u.test(resolved)).toBe(true);
  });

  it("keeps the Windows Desktop bootstrap distinct from the Cloud Bash setup", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const agentInstructions = readFileSync(path.resolve("AGENTS.md"), "utf8");
    const desktopInstructions = readFileSync(path.resolve("docs/agents/codex-desktop-worktree-setup.md"), "utf8");
    const cloudDocumentation = readFileSync(path.resolve("docs/codex-cloud.md"), "utf8");

    expect(packageJson.scripts["setup:codex-worktree"]).toBe("node scripts/setup-codex-worktree.mjs");
    expect(agentInstructions).toContain("docs/agents/codex-desktop-worktree-setup.md");
    expect(desktopInstructions).toContain("Never configure Windows Desktop worktrees");
    expect(desktopInstructions).toContain("node scripts/setup-codex-worktree.mjs --dry-run");
    expect(cloudDocumentation).toContain("This Bash setup is for Linux-based Codex Cloud environments");
  });
});
