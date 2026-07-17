import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const nodeSetup = readFileSync(new URL("../.github/actions/setup-node-cached/action.yml", import.meta.url), "utf8");
const uiSetup = readFileSync(new URL("../.github/actions/setup-ui-e2e/action.yml", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("CI cache safety", () => {
  it("invalidates cached node_modules for every install-contract input", () => {
    const cacheKey = nodeSetup.match(/^\s*key:\s*(node-modules-.*)$/m)?.[1] ?? "";
    expect(cacheKey).toContain(".nvmrc");
    expect(cacheKey).toContain("package.json");
    expect(cacheKey).toContain("package-lock.json");
    expect(cacheKey).toContain(".npmrc");
  });

  it("keeps quarantined and mockup UI specs in one advisory lane", () => {
    expect(workflow).toContain("ui-advisory:");
    expect(workflow).toContain("uses: ./.github/actions/setup-ui-e2e");
    expect(workflow).toContain("run: npm run test:e2e:advisory");
    expect(workflow).not.toContain("ui-quarantine:");
    expect(workflow).not.toContain("ui-mockups:");
  });

  it("installs Playwright system dependencies when browser caches hit", () => {
    expect(uiSetup).toMatch(/cache-hit.*?install-deps chromium.*?install chromium/s);
    expect(workflow).toMatch(/cache-hit.*?install-deps\n\s+npx playwright install/s);
  });
});
