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
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-xs-light", use: { viewport: { width: 320, height: 600 }, colorScheme: "light" } },
    { name: "mobile-xs-dark", use: { viewport: { width: 320, height: 600 }, colorScheme: "dark" } },
    { name: "mobile-sm-light", use: { viewport: { width: 375, height: 812 }, colorScheme: "light" } },
    { name: "mobile-sm-dark", use: { viewport: { width: 375, height: 812 }, colorScheme: "dark" } },
    { name: "tablet-light", use: { viewport: { width: 768, height: 1024 }, colorScheme: "light" } },
    { name: "tablet-dark", use: { viewport: { width: 768, height: 1024 }, colorScheme: "dark" } },
    { name: "desktop-sm-light", use: { viewport: { width: 1024, height: 768 }, colorScheme: "light" } },
    { name: "desktop-sm-dark", use: { viewport: { width: 1024, height: 768 }, colorScheme: "dark" } },
    { name: "desktop-lg-light", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "desktop-lg-dark", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    { name: "desktop-4k-light", use: { viewport: { width: 3840, height: 2160 }, colorScheme: "light" } },
    { name: "desktop-4k-dark", use: { viewport: { width: 3840, height: 2160 }, colorScheme: "dark" } },
  ],
});
