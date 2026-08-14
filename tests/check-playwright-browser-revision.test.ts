import { describe, expect, it } from "vitest";
import {
  findInstalledChromiumBinary,
  listInstalledChromiumRevisions,
  playwrightBrowserRevisionCheck,
  readExpectedChromiumRevision,
  resolveDefaultManagedBrowsersRoot,
} from "../scripts/check-playwright-browser-revision.mjs";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("check-playwright-browser-revision", () => {
  it("reads the chromium revision from the installed playwright-core browsers.json", () => {
    const expected = readExpectedChromiumRevision(process.cwd());
    expect(expected.ok).toBe(true);
    expect(expected.revision).toMatch(/^\d+$/);
  });

  it("fails closed (#312) when no browsers root — forced or default — has a matching binary on disk", () => {
    // This is the exact false-"OK" regression: no PLAYWRIGHT_BROWSERS_PATH is
    // forced, so the old check trusted "unconstrained" as a pass without ever
    // looking at disk. An isolated, guaranteed-empty default cache directory
    // must now report failure, not a green light.
    const emptyDefaultRoot = mkdtempSync(path.join(tmpdir(), "pw-empty-default-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
      writeFileSync(
        path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const result = playwrightBrowserRevisionCheck({
        projectRoot,
        env: { NODE_ENV: "test" },
        defaultManagedBrowsersRoot: emptyDefaultRoot,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe("not-installed");
      expect(result.expectedRevision).toBe("1234");
      expect(result.installedRevisions).toEqual([]);
      expect(result.message).toContain("npx playwright install chromium");
    } finally {
      rmSync(emptyDefaultRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("passes (#312) when the default managed cache actually has a launchable chromium binary", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-default-installed-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      const binary = path.join(root, "chromium-1234", "chrome-linux64", "chrome");
      mkdirSync(path.dirname(binary), { recursive: true });
      writeFileSync(binary, "");

      mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
      writeFileSync(
        path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const result = playwrightBrowserRevisionCheck({
        projectRoot,
        env: { NODE_ENV: "test" },
        defaultManagedBrowsersRoot: root,
        platform: "linux",
        architecture: "x64",
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("installed");
      expect(result.binaryPath).toBe(binary);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("fails closed (#312) when a revision directory exists but has no real binary inside it (partial/corrupt install)", () => {
    // Directory-name matching alone is not enough — this is the residual gap
    // that survived even in the old "container-aligned" path.
    const root = mkdtempSync(path.join(tmpdir(), "pw-empty-dir-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      mkdirSync(path.join(root, "chromium-1234"), { recursive: true });

      mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
      writeFileSync(
        path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const result = playwrightBrowserRevisionCheck({
        projectRoot,
        env: { NODE_ENV: "test" },
        defaultManagedBrowsersRoot: root,
        platform: "linux",
        architecture: "x64",
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe("binary-missing");
      expect(result.installedRevisions).toEqual(["1234"]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("fails closed on /opt/pw-browsers revision drift without suggesting a mismatched executable (#255)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-browsers-"));
    mkdirSync(path.join(root, "chromium_headless_shell-1194"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
    writeFileSync(
      path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
      JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
    );

    const result = playwrightBrowserRevisionCheck({
      projectRoot,
      containerBrowsersRoot: root,
      env: {
        NODE_ENV: "test",
        PLAYWRIGHT_BROWSERS_PATH: root,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("container-revision-drift");
    expect(result.expectedRevision).toBe("1234");
    expect(result.installedRevisions).toEqual(["1194"]);
    expect(result.message).toContain("Delegate browser proof to CI");
    expect(result.message).not.toMatch(/set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to .*1194/);
  });

  it("passes when the designated container actually has a launchable binary for the pinned revision", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-container-aligned-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      const binary = path.join(
        root,
        "chromium_headless_shell-1234",
        "chrome-headless-shell-linux64",
        "chrome-headless-shell",
      );
      mkdirSync(path.dirname(binary), { recursive: true });
      writeFileSync(binary, "");

      mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
      writeFileSync(
        path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const result = playwrightBrowserRevisionCheck({
        projectRoot,
        containerBrowsersRoot: root,
        platform: "linux",
        architecture: "x64",
        env: {
          NODE_ENV: "test",
          PLAYWRIGHT_BROWSERS_PATH: root,
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
        },
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("container-aligned");
      expect(result.binaryPath).toBe(binary);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("fails closed when the designated container has only an empty revision directory, not a real binary (#312)", () => {
    // Same drift status as a fully-missing revision: a same-named empty
    // directory must not be mistaken for an installed, launchable browser.
    const root = mkdtempSync(path.join(tmpdir(), "pw-container-empty-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      mkdirSync(path.join(root, "chromium_headless_shell-1234"), { recursive: true });

      mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
      writeFileSync(
        path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const result = playwrightBrowserRevisionCheck({
        projectRoot,
        containerBrowsersRoot: root,
        platform: "linux",
        architecture: "x64",
        env: {
          NODE_ENV: "test",
          PLAYWRIGHT_BROWSERS_PATH: root,
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
        },
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe("container-revision-drift");
      expect(result.installedRevisions).toEqual(["1234"]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("lists installed chromium revisions from a browsers root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-list-"));
    mkdirSync(path.join(root, "chromium-1234"));
    mkdirSync(path.join(root, "chromium_headless_shell-1234"));
    mkdirSync(path.join(root, "firefox-1000"));
    expect(listInstalledChromiumRevisions(root)).toEqual(["1234"]);
  });

  it("finds the actual chromium binary for a revision, not just its directory", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-find-binary-"));
    try {
      expect(findInstalledChromiumBinary(root, "1234", { platform: "linux", architecture: "x64" })).toBeNull();

      const binary = path.join(root, "chromium-1234", "chrome-linux64", "chrome");
      mkdirSync(path.dirname(binary), { recursive: true });
      writeFileSync(binary, "");
      expect(findInstalledChromiumBinary(root, "1234", { platform: "linux", architecture: "x64" })).toBe(binary);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("resolves the platform-specific default managed-cache directory", () => {
    const baseEnv = { NODE_ENV: "test" as const };
    expect(resolveDefaultManagedBrowsersRoot(baseEnv, "/home/dev", "linux").replaceAll("\\", "/")).toBe(
      "/home/dev/.cache/ms-playwright",
    );
    expect(
      resolveDefaultManagedBrowsersRoot(
        { ...baseEnv, XDG_CACHE_HOME: "/custom/cache" },
        "/home/dev",
        "linux",
      ).replaceAll("\\", "/"),
    ).toBe("/custom/cache/ms-playwright");
    expect(resolveDefaultManagedBrowsersRoot(baseEnv, "/Users/dev", "darwin").replaceAll("\\", "/")).toBe(
      "/Users/dev/Library/Caches/ms-playwright",
    );
    expect(resolveDefaultManagedBrowsersRoot(baseEnv, "C:/Users/dev", "win32").replaceAll("\\", "/")).toBe(
      "C:/Users/dev/AppData/Local/ms-playwright",
    );
    expect(
      resolveDefaultManagedBrowsersRoot({ ...baseEnv, LOCALAPPDATA: "C:/custom" }, "C:/Users/dev", "win32").replaceAll(
        "\\",
        "/",
      ),
    ).toBe("C:/custom/ms-playwright");
  });
});
