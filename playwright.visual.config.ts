import { defineConfig, devices } from "playwright/test";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

const baseURL = getPlaywrightBaseUrl({ allowEnsure: false });

// Sandboxed CI/cloud containers often ship a preinstalled Chromium and block
// browser downloads; point this at that binary instead of the managed one.
// Mirrors playwright.config.ts — without it this config cannot run where the
// required UI gate can.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests",
  // Two specs with different jobs: `ui-visual-artifacts` attaches screenshots for
  // human review, `ui-visual-baseline` compares them against committed baselines.
  testMatch: /.*ui-visual-(artifacts|baseline)\.spec\.ts/,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Antialiasing differs by a hair between Chromium patch releases even on one
      // platform, so an exact-match gate would be red on every browser bump. This
      // tolerance absorbs that while still catching a moved element, a colour
      // change, or a font-size change — all of which move far more than 0.2% of
      // pixels. Tighten it if a real regression ever slips under.
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  // Baselines are platform-specific: font hinting and antialiasing on a developer
  // machine do not match the Linux CI runner, and a shared path would make every
  // cross-platform run a false diff. A platform with no committed baseline fails
  // loudly ("snapshot doesn't exist") instead of quietly passing.
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  // Zero retries, matching the repository's "blocking tests run with zero retries"
  // policy — and here it is load-bearing rather than conventional. On a missing
  // baseline Playwright WRITES the golden and fails the first attempt; a retry then
  // compares against that freshly-written file and can pass. That would let a new
  // target or a new platform report green with no committed, reviewed baseline,
  // which is the exact opposite of the fail-loud contract this suite documents.
  retries: 0,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "test-results/visual-junit.xml" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Match the required UI gate: motion off so a capture cannot land mid-transition.
    contextOptions: { reducedMotion: "reduce" },
    // In production builds public/sw.js registers, claims the page, and serves every
    // later navigation — which makes route content depend on cache state rather than
    // on the build. Baselines must not be compared against a service-worker response.
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
