import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every Playwright project must be visible somewhere a person looks: either an npm script names
 * it with `--project=`, or `docs/testing.md` records the cadence it actually runs on.
 *
 * L68: `mobile-webkit` and `mobile-pwa-standalone` were defined but named by no script and no CI
 * step, so they ran only when the release matrix fell back to the whole suite — and
 * `docs/testing.md` described that matrix as Chromium shards plus Firefox/WebKit, which made the
 * gap invisible to anyone reading the docs. This test fails closed for any future project that
 * lands in the same silence.
 */
function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function playwrightProjectNames(source: string) {
  const projectsBlock = source.slice(source.indexOf("projects: ["));
  const names = Array.from(projectsBlock.matchAll(/name: ["']([a-z0-9-]+)["']/gi)).map((match) => match[1]);
  expect(names.length, "playwright.config.ts: could not read any project names — update this helper").toBeGreaterThan(
    4,
  );
  return names;
}

describe("Playwright project cadence is declared, not implied", () => {
  const config = readSource("playwright.config.ts");
  const packageJson = readSource("package.json");
  const testingDoc = readSource("docs/testing.md");
  // Prose names engines in prose case ("Firefox", "WebKit"); compare case-insensitively.
  const testingDocLower = testingDoc.toLowerCase();

  it("names every configured project in a package script or in the docs/testing.md cadence record", () => {
    for (const project of playwrightProjectNames(config)) {
      const selectedByScript = packageJson.includes(`--project=${project}`);
      const documented = testingDocLower.includes(project);
      expect(
        selectedByScript || documented,
        `Playwright project "${project}" is selected by no npm script and documented in no cadence record. ` +
          "Add it to a script, or record in docs/testing.md when it runs and why.",
      ).toBe(true);
    }
  });

  it("records why the two iPhone projects stay release-only", () => {
    for (const project of ["mobile-webkit", "mobile-pwa-standalone"]) {
      expect(config, `${project} is missing from playwright.config.ts`).toContain(`name: "${project}"`);
      expect(
        testingDocLower,
        `docs/testing.md must name ${project} so its cadence is visible to a reader of the docs`,
      ).toContain(project);
    }
    // The record must state the cadence, not merely mention the names.
    expect(testingDoc).toMatch(/release[- ]only|release matrix/i);
  });
});
