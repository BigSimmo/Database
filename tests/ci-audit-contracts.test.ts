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

describe("M25: the daily staging tenancy harness has a failure reporting path", () => {
  it("is watched by notify-ci-failure.yml under its exact workflow name", () => {
    const name = read(".github/workflows/staging-tenancy.yml")
      .match(/^name:\s*(.+)$/m)?.[1]
      ?.trim();
    expect(name).toBe("Staging tenancy isolation");
    const notify = read(".github/workflows/notify-ci-failure.yml");
    const watched = notify.match(/workflows:\n((?:\s+(?:- |#).*\n)+)/)?.[1] ?? "";
    const names = watched
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim());
    expect(names).toContain(name);
  });
});

describe("M29: the live Web-Vitals default routes can produce a verdict", () => {
  const workflow = read(".github/workflows/live-web-vitals.yml");
  const defaultRoutes = workflow.match(/^\s+default:\s*"((?:\/[^"]*)?)"\s*$/m)?.[1];

  it("declares a default route list", () => {
    expect(defaultRoutes).toBeDefined();
    expect(defaultRoutes!.split(",").length).toBeGreaterThan(0);
  });

  // The summariser deliberately rejects a report whose final URL differs from
  // the requested URL, so a default entry that server-redirects (the retired
  // `/dsm`, `/forms`, `/therapy-compass` mode homes since #2157/#2308) can
  // never be graded. Every default route must therefore resolve to a page.tsx
  // that renders in place. `/` is the one route whose `redirect(` is guarded
  // by legacy query parameters (docs/site-map.md: "Main PsychSift shell"), so
  // its plain GET renders and it is exempt from the redirect check.
  it.each((defaultRoutes ?? "").split(","))("default route %s renders in place rather than redirecting", (route) => {
    const segment = route === "/" ? "" : route.replace(/^\//, "");
    const candidates = [`src/app/(search-app)/${segment}/page.tsx`, `src/app/${segment}/page.tsx`].map((path) =>
      path.replace("//", "/"),
    );
    const page = candidates.find((candidate) => exists(candidate));
    expect(page, `no page.tsx for ${route} (tried ${candidates.join(", ")})`).toBeDefined();
    if (route !== "/") {
      expect(read(page!)).not.toMatch(/\bredirect\(/);
    }
  });

  it("keeps the summariser's test fixture in step with the workflow default", () => {
    const fixture = read("tests/summarise-web-vitals.test.ts").match(/const DEFAULT_ROUTES = "([^"]+)"/)?.[1];
    expect(fixture).toBe(defaultRoutes);
  });

  it("no longer instructs recording the verdict against the closed #017 row", () => {
    expect(workflow).not.toMatch(/Record the verdict in docs\/outstanding-issues\.md against #017/);
  });
});
