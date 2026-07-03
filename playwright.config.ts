import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

const baseURL = getPlaywrightBaseUrl();

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
      use: { ...devices["Desktop Chrome"] },
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
