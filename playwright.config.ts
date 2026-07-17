import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

const baseURL = getPlaywrightBaseUrl({ allowEnsure: false });

// Sandboxed CI/cloud containers often ship a preinstalled Chromium and block
// browser downloads; point this at that binary instead of the managed one.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// Prototype /mockups journeys live in their own advisory project so a red
// mockup can never mask a production-journey regression (PT-05). The two
// Tag-level filters keep production and prototype journeys disjoint even when
// they share a spec file.
const productionSpecPattern = /.*ui-(smoke|stress|accessibility|tools|overlap|universal-search|formulation)\.spec\.ts/;
const mockupSpecPattern = /.*ui-(tools|tools-collapse|tools-task-directory)\.spec\.ts/;
const mockupTag = /@mockup/;

export default defineConfig({
  testDir: "./tests",
  testMatch:
    /.*ui-(smoke|stress|accessibility|tools|tools-collapse|tools-task-directory|overlap|universal-search|formulation)\.spec\.ts/,
  timeout: 60_000,
  retries: 0,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["list"],
        ["junit", { outputFile: "test-results/playwright-junit.xml" }],
        ["json", { outputFile: "test-results/playwright-results.json" }],
      ]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      name: "chromium-mockups",
      testMatch: mockupSpecPattern,
      grep: mockupTag,
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      name: "firefox",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
