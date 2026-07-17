import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

const baseURL = getPlaywrightBaseUrl();

// Sandboxed CI/cloud containers often ship a preinstalled Chromium and block
// browser downloads; point this at that binary instead of the managed one.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// Prototype /mockups journeys live in their own advisory project so a red
// mockup can never mask a production-journey regression (PT-05). The two
// Tag-level filters keep production and prototype journeys disjoint even when
// they share a spec file; firefox/webkit retain the legacy full testMatch.
const productionSpecPattern =
  /.*ui-(smoke|stress|accessibility|tools|overlap|universal-search|specifiers|formulation|pwa)\.spec\.ts/;
const mockupSpecPattern = /.*ui-(tools|tools-collapse|tools-task-directory)\.spec\.ts/;
const mockupTag = /@mockup/;

export default defineConfig({
  testDir: "./tests",
  testMatch:
    /.*ui-(smoke|stress|accessibility|tools|tools-collapse|tools-task-directory|overlap|universal-search|specifiers|formulation|pwa)\.spec\.ts/,
  timeout: 60_000,
  // Two CI retries (was 1) absorb the residual ledger flakes (rAF-portal
  // hydration, sub-pixel tap targets) without masking a real regression, which
  // still fails 3× before it is reported. Local stays at 0 so flakes surface.
  retries: process.env.CI ? 2 : 0,
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
    // Disable CSS/web animations suite-wide so a click can't land mid-transition
    // on a moving target (documented races in ui-stress/ui-smoke). Set via
    // contextOptions (the supported form in this Playwright build); the dedicated
    // reduced-motion a11y spec emulates it per-test too, so it is unaffected.
    contextOptions: { reducedMotion: "reduce" },
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
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
