import { describe, expect, it } from "vitest";
import {
  defaultChromiumHeadlessShellPath,
  playwrightBrowserPreflight,
  requestedPlaywrightBrowserProjects,
  resolvePlaywrightBrowserExecutable,
} from "../scripts/playwright-browser-preflight.mjs";

describe("playwright browser preflight", () => {
  it("defaults to chromium when no project is requested", () => {
    expect(requestedPlaywrightBrowserProjects([])).toEqual(["chromium"]);
    expect(requestedPlaywrightBrowserProjects(["tests/ui-smoke.spec.ts"])).toEqual(["chromium"]);
  });

  it("collects explicit --project flags", () => {
    expect(requestedPlaywrightBrowserProjects(["--project=firefox", "--project", "webkit"])).toEqual([
      "firefox",
      "webkit",
    ]);
  });

  it("derives the headless-shell binary Playwright launches by default", () => {
    expect(
      defaultChromiumHeadlessShellPath(
        "/home/ubuntu/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
      ).replaceAll("\\", "/"),
    ).toBe(
      "/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
    );
  });

  it("honours PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for Chromium projects", () => {
    const resolved = resolvePlaywrightBrowserExecutable("chromium", {
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "/tmp/custom-chrome",
    });
    expect(resolved).toEqual({
      family: "chromium",
      path: "/tmp/custom-chrome",
      source: "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
    });
  });

  it("fails closed when the required Chromium binary is missing", () => {
    const result = playwrightBrowserPreflight(["--project=chromium"], {
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: `/tmp/missing-chrome-${Date.now()}`,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Playwright browser preflight failed before the production build");
    expect(result.message).toContain("Missing executable");
    expect(result.missing?.[0]?.family).toBe("chromium");
  });

  it("passes when an override path exists", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = mkdtempSync(join(tmpdir(), "pw-preflight-"));
    const binary = join(directory, "chrome");
    try {
      writeFileSync(binary, "");
      const result = playwrightBrowserPreflight(["--project=chromium-mockups"], {
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: binary,
      });
      expect(result.ok).toBe(true);
      expect(result.checked?.[0]?.path).toBe(binary);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
