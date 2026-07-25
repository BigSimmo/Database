import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildReconciliationEvidencePack,
  writeReconciliationEvidencePack,
} from "../scripts/reconciliation-evidence-pack.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function git(args: string[], cwd: string) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

function createFixtureRepository() {
  const root = temporaryDirectory("evidence-pack-");
  git(["init", "-b", "main"], root);
  git(["config", "user.email", "evidence@example.test"], root);
  git(["config", "user.name", "Evidence Fixture"], root);
  writeFileSync(path.join(root, "README.md"), "evidence\n", "utf8");
  git(["add", "README.md"], root);
  git(["commit", "-m", "evidence root"], root);
  const head = git(["rev-parse", "HEAD"], root);
  git(["update-ref", "refs/archive/retained/fixture", head], root);
  return { root, head };
}

describe("reconciliation evidence pack (#078)", () => {
  it("builds a deterministic secret-safe pack with required local evidence fields", async () => {
    const { root, head } = createFixtureRepository();
    const secret = ["sk", "example-secret-1234567890abcdef"].join("-");
    const pack = await buildReconciliationEvidencePack({
      repositoryRoot: root,
      baseRef: "main",
      now: () => new Date("2026-07-24T18:00:00.000Z"),
      dispositions: [
        {
          path: root,
          head,
          branch: "main",
          disposition: "retained",
          note: `owner OPENAI_API_KEY=${secret}`,
        },
      ],
      remotePrState: { approvedInput: true, url: `https://example.test/pr?token=${secret}` },
    });

    expect(pack).toMatchObject({
      schemaVersion: 1,
      kind: "reconciliation-evidence-pack",
      status: "complete",
      generatedAt: "2026-07-24T18:00:00.000Z",
      cachedRefsOnly: true,
      fetched: false,
      providerCalls: false,
      mutations: false,
      frozen: {
        baseRef: "main",
        baseCommit: head,
        primaryHead: head,
      },
      totals: { retainedWorktrees: 1, worktrees: 1 },
      localBaseTreeEquality: { comparable: true, equal: true },
      remotePrState: { included: true },
    });
    expect(pack.archiveRefs).toEqual([{ ref: "refs/archive/retained/fixture", object: head }]);
    expect(pack.dispositions[0]).toMatchObject({ disposition: "retained", head });
    expect(pack.operationMarkersCatalog).toContain("MERGE_HEAD");
    expect(pack.bundle).toMatchObject({ provided: false });

    const serialized = JSON.stringify(pack);
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);

    const again = await buildReconciliationEvidencePack({
      repositoryRoot: root,
      baseRef: "main",
      now: () => new Date("2026-07-24T18:00:00.000Z"),
      dispositions: pack.dispositions,
      remotePrState: { approvedInput: true, url: `https://example.test/pr?token=${secret}` },
    });
    expect(again).toEqual(pack);
  });

  it("writes atomically so an interrupted partial file is not a completion record", async () => {
    const { root } = createFixtureRepository();
    const pack = await buildReconciliationEvidencePack({
      repositoryRoot: root,
      baseRef: "main",
      now: () => new Date("2026-07-24T18:00:00.000Z"),
    });
    const outputDirectory = temporaryDirectory("evidence-out-");
    const outputPath = path.join(outputDirectory, "pack.json");
    const partialPath = `${outputPath}.partial`;

    expect(existsSync(outputPath)).toBe(false);
    writeFileSync(partialPath, '{"status":"incomplete"}\n', "utf8");
    expect(existsSync(outputPath)).toBe(false);

    const written = writeReconciliationEvidencePack({ outputPath, pack });
    expect(written).toBe(outputPath);
    expect(existsSync(partialPath)).toBe(false);
    expect(JSON.parse(readFileSync(outputPath, "utf8"))).toMatchObject({
      status: "complete",
      kind: "reconciliation-evidence-pack",
    });
  });

  it("records bundle path, size, sha256, and verify result when a bundle is provided", async () => {
    const { root, head } = createFixtureRepository();
    const bundlePath = path.join(temporaryDirectory("bundle-"), "recovery.bundle");
    git(["bundle", "create", bundlePath, "HEAD"], root);
    const expectedSha = createHash("sha256").update(readFileSync(bundlePath)).digest("hex");

    const pack = await buildReconciliationEvidencePack({
      repositoryRoot: root,
      baseRef: "main",
      bundlePath,
      now: () => new Date("2026-07-24T18:00:00.000Z"),
    });

    expect(pack.bundle).toMatchObject({
      provided: true,
      exists: true,
      sha256: expectedSha,
      verify: { ok: true },
    });
    expect(pack.bundle.sizeBytes).toBeGreaterThan(0);
    expect(pack.frozen.primaryHead).toBe(head);
  });
});
