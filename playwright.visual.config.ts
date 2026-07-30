import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

/**
 * Local-only screenshot capture config for `npm run test:e2e:visual`.
 * Not part of required CI (`test:e2e:pr` / Production UI). Attach-only captures
 * with no baseline comparison — see docs/outstanding-issues.md #040.
 */
const baseURL = getPlaywrightBaseUrl({ allowEnsure: false });

// Sandboxed CI/cloud containers often ship a preinstalled Chromium and block
// browser downloads; point this at that binary instead of the managed one.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*ui-visual-artifacts\.spec\.ts/,
  timeout: 30_000,
  retries: 0,
  forbidOnly: !!process.env.CI,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    contextOptions: { reducedMotion: "reduce" },
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-artifacts",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
  ],
});
