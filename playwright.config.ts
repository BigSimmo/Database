import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

const baseURL = getPlaywrightBaseUrl();

// Sandboxed/CI containers often pre-install a single Chromium at a fixed path
// instead of the exact revision this Playwright version pins. Honour an
// explicit executable override there without affecting normal installs.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*ui-(smoke|stress|accessibility|tools|tools-task-directory|overlap)\.spec\.ts/,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
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
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
