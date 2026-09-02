import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Contracts pinned by the 2026-09-02 repository audit (package p8a: CI
// workflows and supply chain). Each block names the finding it closes so a
// later edit that reopens the gap fails with the audit's own reasoning.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path: string) => existsSync(new URL(`../${path}`, import.meta.url));

/** The `- package-ecosystem: "<name>"` blocks of dependabot.yml, keyed by ecosystem + directory. */
function dependabotEntries(source: string) {
  const entries: Array<{ ecosystem: string; directory: string; body: string }> = [];
  const blocks = source.split(/\n(?=  - package-ecosystem:)/);
  for (const block of blocks) {
    const ecosystem = block.match(/package-ecosystem:\s*"([^"]+)"/)?.[1];
    const directory = block.match(/directory:\s*"([^"]+)"/)?.[1];
    if (ecosystem && directory) entries.push({ ecosystem, directory, body: block });
  }
  return entries;
}

describe("M20: the worker's Python parsing stack has a vulnerability signal", () => {
  const dependabot = read(".github/dependabot.yml");
  const entries = dependabotEntries(dependabot);

  it.each(["/worker/python", "/eval/docling"])("Dependabot watches the pip lock in %s", (directory) => {
    const entry = entries.find((candidate) => candidate.ecosystem === "pip" && candidate.directory === directory);
    expect(entry, `no pip ecosystem entry for ${directory}`).toBeDefined();
    // Both locks are hash-pinned by pip-compile; the entry must say how the
    // hashes are regenerated so a bump is not merged with a stale lock.
    expect(entry!.body).toMatch(/generate:worker-python-lock|check:worker-python-locks/);
  });

  it("keeps a hashed requirements lock at every pip directory Dependabot watches", () => {
    for (const entry of entries.filter((candidate) => candidate.ecosystem === "pip")) {
      const lock = `${entry.directory.replace(/^\//, "")}/requirements.txt`;
      expect(exists(lock), `${lock} missing`).toBe(true);
      expect(read(lock)).toContain("--hash=sha256:");
    }
  });

  it("reports HIGH/CRITICAL image findings where a person sees them", () => {
    const workflow = read(".github/workflows/docker-image.yml");
    const scanIndex = workflow.indexOf("Vulnerability scan (HIGH,CRITICAL)");
    expect(scanIndex).toBeGreaterThan(-1);
    const afterScan = workflow.slice(scanIndex);
    // The scan output is kept, summarised into the job summary, and the
    // follow-up step exits non-zero on HIGH/CRITICAL outside pull-request
    // runs so the scheduled/main run fails and notify-ci-failure.yml (which
    // already watches "Docker image build") delivers it to chat.
    expect(afterScan).toContain("GITHUB_STEP_SUMMARY");
    expect(afterScan).toMatch(/Fail on HIGH\/CRITICAL image findings/);
    expect(afterScan).toMatch(/github\.event_name != 'pull_request'/);
    expect(afterScan).toMatch(/github\.event_name != 'merge_group'/);
    expect(afterScan).toMatch(/exit 1/);
  });
});
