import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const nodeSetup = readFileSync(new URL("../.github/actions/setup-node-cached/action.yml", import.meta.url), "utf8");
const uiSetup = readFileSync(new URL("../.github/actions/setup-ui-e2e/action.yml", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("CI cache safety", () => {
  it("uses npm's download cache but recreates node_modules on every job", () => {
    expect(nodeSetup).toContain("cache: npm");
    expect(nodeSetup).toContain("cache-dependency-path: package-lock.json");
    expect(nodeSetup).toContain("run: npm ci --include=dev");
    expect(nodeSetup).not.toContain("path: node_modules");
    expect(nodeSetup).not.toContain("cache-hit");
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
