import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { validateLinuxVisualBaselineSet } from "../scripts/generate-design-system-adoption.mjs";

const root = path.resolve(__dirname, "..");
const scriptPath = path.join(root, "scripts/adopt-visual-baselines.mjs");
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGklEQVQ4jWP4TyFgGDXg/2gY/B8Ng//DIgwAXXj8LuMlDaEAAAAASUVORK5CYII=",
  "base64",
);
const baselineIds = [
  "dashboard-shell",
  "dashboard-shell-phone",
  "search-results-band",
  "search-results-band-phone",
  "document-viewer",
  "therapy-compass-home",
];

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function withAwaitingValues(sourceText: string, values: string) {
  return sourceText.replace(
    /(const\s+AWAITING_BASELINE(?:\s*:\s*[^=]+)?\s*=\s*new Set\()\[[\s\S]*?\](\);)/,
    `$1[${values}]$2`,
  );
}

function git(fixtureRoot: string, args: string[]) {
  return execFileSync("git", args, {
    cwd: fixtureRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitFixture(fixtureRoot: string, message: string) {
  git(fixtureRoot, ["add", "-A"]);
  git(fixtureRoot, ["commit", "-q", "-m", message]);
  return git(fixtureRoot, ["rev-parse", "HEAD"]);
}

function writePng(fixtureRoot: string, relativePath: string, content: Buffer = validPng) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function writeVisualJunit(artifactDir: string, outcomes: Record<string, "passed" | "failed" | "skipped">) {
  const cases = baselineIds
    .map((id) => {
      const outcome = outcomes[id] ?? "passed";
      if (outcome === "failed") {
        return `<testcase name="visual baselines › ${id} matches its baseline" classname="ui-visual-baseline.spec.ts" time="1"><failure message="diff">failed</failure></testcase>`;
      }
      if (outcome === "skipped") {
        return `<testcase name="visual baselines › ${id} matches its baseline" classname="ui-visual-baseline.spec.ts" time="1"><skipped/></testcase>`;
      }
      return `<testcase name="visual baselines › ${id} matches its baseline" classname="ui-visual-baseline.spec.ts" time="1"/>`;
    })
    .join("");
  const xml = `<?xml version="1.0"?><testsuites><testsuite name="ui-visual-baseline.spec.ts" tests="${baselineIds.length}">${cases}</testsuite></testsuites>`;
  const absolutePath = path.join(artifactDir, "test-results/visual-junit.xml");
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, xml);
}

function adoptBaselines(
  fixtureRoot: string,
  {
    artifactDir,
    head,
    write = true,
    reviewedBy = "Fixture Reviewer",
    reviewedByLogin,
  }: {
    artifactDir: string;
    head: string;
    write?: boolean;
    reviewedBy?: string;
    reviewedByLogin?: string;
  },
) {
  const args = [scriptPath, "--from", artifactDir, "--run-id", "424242", "--head", head, "--reviewed-by", reviewedBy];
  if (reviewedByLogin) args.push("--reviewed-by-login", reviewedByLogin);
  if (write) args.push("--write");
  return execFileSync("node", args, {
    cwd: fixtureRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function seedRepository(fixtureRoot: string, awaitingValues: string) {
  git(fixtureRoot, ["init", "-q"]);
  git(fixtureRoot, ["config", "user.email", "fixture@example.invalid"]);
  git(fixtureRoot, ["config", "user.name", "Fixture"]);
  fs.mkdirSync(path.join(fixtureRoot, "src/app"), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, "tests"), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, "src/app/page.tsx"), "export default function Page() { return null; }\n");
  fs.writeFileSync(
    path.join(fixtureRoot, "tests/ui-visual-baseline.spec.ts"),
    withAwaitingValues(read("tests/ui-visual-baseline.spec.ts"), awaitingValues),
  );
  return commitFixture(fixtureRoot, "candidate source");
}

describe("adopt-visual-baselines.mjs", () => {
  it("retains unchanged baselines during a partial refresh artifact", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-partial-"));
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-artifact-"));
    try {
      const head = seedRepository(fixtureRoot, "");
      for (const id of baselineIds) writePng(fixtureRoot, `tests/__screenshots__/linux/${id}.png`, validPng);
      commitFixture(fixtureRoot, "seed committed baselines");

      writePng(artifactDir, "test-results/ui-visual-baseline/dashboard-shell-actual.png", validPng);
      for (const id of baselineIds.slice(1)) {
        writePng(artifactDir, `tests/__screenshots__/linux/${id}.png`, validPng);
      }
      writeVisualJunit(artifactDir, {
        "dashboard-shell": "failed",
        "dashboard-shell-phone": "passed",
        "search-results-band": "passed",
        "search-results-band-phone": "passed",
        "document-viewer": "passed",
        "therapy-compass-home": "passed",
      });

      const output = adoptBaselines(fixtureRoot, { artifactDir, head });
      expect(output).toContain("dashboard-shell");
      expect(output).toContain("retained");
      expect(output).toContain("Capture kind: refresh (1 replaced from artifact)");

      const provenance = JSON.parse(
        fs.readFileSync(path.join(fixtureRoot, "tests/__screenshots__/linux/provenance.json"), "utf8"),
      );
      expect(provenance.capture).toEqual({ kind: "refresh", replacedCandidateIds: ["dashboard-shell"] });
      expect(provenance.candidateSourceHead).toBe(head);

      const baselinePaths = baselineIds.map((id) => `tests/__screenshots__/linux/${id}.png`);
      const trackedFiles = new Set([...baselinePaths, "tests/__screenshots__/linux/provenance.json"]);
      expect(validateLinuxVisualBaselineSet(baselinePaths, { root: fixtureRoot, trackedFiles })).toEqual([]);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
      fs.rmSync(artifactDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("accepts a refresh capture head with empty AWAITING_BASELINE", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-refresh-"));
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-artifact-"));
    try {
      const head = seedRepository(fixtureRoot, "");
      for (const id of baselineIds) writePng(fixtureRoot, `tests/__screenshots__/linux/${id}.png`, validPng);
      commitFixture(fixtureRoot, "seed committed baselines");

      writePng(artifactDir, "test-results/ui-visual-baseline/dashboard-shell-actual.png", validPng);
      for (const id of baselineIds.slice(1)) {
        writePng(artifactDir, `tests/__screenshots__/linux/${id}.png`, validPng);
      }
      writeVisualJunit(artifactDir, {
        "dashboard-shell": "failed",
        "dashboard-shell-phone": "passed",
        "search-results-band": "passed",
        "search-results-band-phone": "passed",
        "document-viewer": "passed",
        "therapy-compass-home": "passed",
      });

      adoptBaselines(fixtureRoot, { artifactDir, head });

      const baselinePaths = baselineIds.map((id) => `tests/__screenshots__/linux/${id}.png`);
      const trackedFiles = new Set([...baselinePaths, "tests/__screenshots__/linux/provenance.json"]);
      expect(validateLinuxVisualBaselineSet(baselinePaths, { root: fixtureRoot, trackedFiles })).toEqual([]);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
      fs.rmSync(artifactDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("refuses to retain a baseline without a passing visual-junit result", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-nojunit-"));
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-artifact-"));
    try {
      const head = seedRepository(fixtureRoot, "");
      for (const id of baselineIds) writePng(fixtureRoot, `tests/__screenshots__/linux/${id}.png`, validPng);
      commitFixture(fixtureRoot, "seed committed baselines");

      writePng(artifactDir, "test-results/ui-visual-baseline/dashboard-shell-actual.png", validPng);
      for (const id of baselineIds.slice(1)) {
        writePng(artifactDir, `tests/__screenshots__/linux/${id}.png`, validPng);
      }

      expect(() => adoptBaselines(fixtureRoot, { artifactDir, head })).toThrow(/visual-junit\.xml/);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
      fs.rmSync(artifactDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("refuses to stamp GitHub Copilot or other automated attributions as human approval", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-copilot-"));
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-artifact-"));
    try {
      const head = seedRepository(fixtureRoot, "");
      for (const id of baselineIds) writePng(fixtureRoot, `tests/__screenshots__/linux/${id}.png`, validPng);
      commitFixture(fixtureRoot, "seed committed baselines");

      writePng(artifactDir, "test-results/ui-visual-baseline/dashboard-shell-actual.png", validPng);
      for (const id of baselineIds.slice(1)) {
        writePng(artifactDir, `tests/__screenshots__/linux/${id}.png`, validPng);
      }
      writeVisualJunit(artifactDir, {
        "dashboard-shell": "failed",
        "dashboard-shell-phone": "passed",
        "search-results-band": "passed",
        "search-results-band-phone": "passed",
        "document-viewer": "passed",
        "therapy-compass-home": "passed",
      });

      expect(() => adoptBaselines(fixtureRoot, { artifactDir, head, reviewedBy: "GitHub Copilot" })).toThrow(
        /verified human identity/,
      );
      expect(() => adoptBaselines(fixtureRoot, { artifactDir, head, reviewedBy: "build-service" })).toThrow(
        /project allowlist/,
      );
      expect(() =>
        adoptBaselines(fixtureRoot, {
          artifactDir,
          head,
          reviewedBy: "Alice",
          reviewedByLogin: "build-service",
          write: false,
        }),
      ).toThrow(/project allowlist/);
      expect(() => adoptBaselines(fixtureRoot, { artifactDir, head, reviewedBy: "Alice", write: false })).not.toThrow();
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
      fs.rmSync(artifactDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("records per-candidate SHA-256 values that match the written PNGs", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-hash-"));
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "adopt-visual-artifact-"));
    try {
      const awaitingValues = baselineIds.map((id) => JSON.stringify(id)).join(", ");
      const head = seedRepository(fixtureRoot, awaitingValues);
      fs.writeFileSync(
        path.join(fixtureRoot, "tests/ui-visual-baseline.spec.ts"),
        withAwaitingValues(read("tests/ui-visual-baseline.spec.ts"), ""),
      );
      for (const id of baselineIds) {
        writePng(artifactDir, `test-results/visual-candidates/linux/${id}.png`, validPng);
      }

      adoptBaselines(fixtureRoot, { artifactDir, head });

      const provenance = JSON.parse(
        fs.readFileSync(path.join(fixtureRoot, "tests/__screenshots__/linux/provenance.json"), "utf8"),
      );
      expect(provenance.capture).toEqual({ kind: "first-adoption" });
      for (const candidate of provenance.candidates) {
        const image = fs.readFileSync(path.join(fixtureRoot, candidate.path));
        expect(candidate.sha256).toBe(createHash("sha256").update(image).digest("hex"));
      }
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
      fs.rmSync(artifactDir, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
