import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

const baseURL = getPlaywrightBaseUrl({ allowEnsure: false });

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*ui-visual-artifacts\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "list",
  // Match the production config's deliberate serialisation. Left unset, this config
  // inherited Playwright's default `workers = 50% of CPUs`, so the visual lane ran under
  // a concurrency the rest of the suite is explicitly configured to avoid.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-artifacts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
