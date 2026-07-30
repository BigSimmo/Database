import { describe, expect, it } from "vitest";
import {
  defaultChromiumHeadlessShellPath,
  playwrightBrowserPreflight,
  playwrightProjectNames,
  requestedPlaywrightBrowserProjects,
  resolvePlaywrightBrowserExecutable,
} from "../scripts/playwright-browser-preflight.mjs";

describe("playwright browser preflight", () => {
  it("defaults to every configured project when no project is requested", () => {
    const configuredProjects = Object.values(playwrightProjectNames);
    expect(requestedPlaywrightBrowserProjects([])).toEqual(configuredProjects);
    expect(requestedPlaywrightBrowserProjects(["tests/ui-smoke.spec.ts"])).toEqual(configuredProjects);
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
    expect(
      defaultChromiumHeadlessShellPath(
        "/home/ubuntu/.cache/ms-playwright/chromium-1234/chrome-linux/chrome",
      )?.replaceAll("\\", "/"),
    ).toBe("/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1234/chrome-linux/headless_shell");
    expect(
      defaultChromiumHeadlessShellPath(
        "/Users/test/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
      )?.replaceAll("\\", "/"),
    ).toBe(
      "/Users/test/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell",
    );
    expect(
      defaultChromiumHeadlessShellPath(
        "C:/Users/test/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
      )?.replaceAll("\\", "/"),
    ).toBe(
      "C:/Users/test/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe",
    );
    expect(defaultChromiumHeadlessShellPath("/opt/custom/chrome")).toBeNull();
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

  it("fails closed for a project missing from the shared project map", () => {
    const result = playwrightBrowserPreflight(["--project=future-browser"]);
    expect(result.ok).toBe(false);
    expect(result.missing?.[0]?.source).toContain("unmapped Playwright project future-browser");
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
