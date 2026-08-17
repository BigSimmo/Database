import { describe, expect, it } from "vitest";
import {
  findInstalledChromiumBinary,
  listInstalledBrowserRevisions,
  listInstalledChromiumRevisions,
  playwrightBrowserRevisionCheck,
  readExpectedBrowserRevisions,
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

  it("reads all browser revisions from the installed playwright-core browsers.json (#312)", () => {
    const expected = readExpectedBrowserRevisions(process.cwd());
    expect(expected.ok).toBe(true);
    if (expected.ok) {
      expect(expected.revisions.chromium).toMatch(/^\d+$/);
      expect(expected.revisions.firefox).toMatch(/^\d+$/);
      expect(expected.revisions.webkit).toMatch(/^\d+$/);
    }
  });

  it("fails closed when browsers.json is missing a required browser's revision (#312)", () => {
    for (const missing of ["firefox", "webkit"]) {
      const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-missing-revision-"));
      try {
        mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
        writeFileSync(
          path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
          JSON.stringify({
            browsers: [
              { name: "chromium", revision: "1234" },
              { name: "firefox", revision: "1538" },
              { name: "webkit", revision: "2336" },
            ].filter((entry) => entry.name !== missing),
          }),
        );

        const expected = readExpectedBrowserRevisions(projectRoot);
        expect(expected.ok, `${missing} revision absent must fail closed, not silently omit it`).toBe(false);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    }
  });

  it("lists installed browser revisions across families (#312)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-multi-browsers-"));
    try {
      mkdirSync(path.join(root, "chromium_headless_shell-1234"), { recursive: true });
      mkdirSync(path.join(root, "firefox-1538"), { recursive: true });
      mkdirSync(path.join(root, "webkit-2336"), { recursive: true });

      expect(listInstalledBrowserRevisions(root, "chromium")).toEqual(["1234"]);
      expect(listInstalledBrowserRevisions(root, "firefox")).toEqual(["1538"]);
      expect(listInstalledBrowserRevisions(root, "webkit")).toEqual(["2336"]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
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

  it("passes (#312) when the default managed cache has a launchable headless-shell binary", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-default-installed-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      const binary = path.join(
        root,
        "chromium_headless_shell-1234",
        "chrome-headless-shell-linux64",
        "chrome-headless-shell",
      );
      mkdirSync(path.dirname(binary), { recursive: true });
      writeFileSync(binary, "", { mode: 0o755 });

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
      writeFileSync(binary, "", { mode: 0o755 });

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

  it("fails closed when only full Chrome is present because the default projects launch headless shell", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-full-chrome-only-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      const fullChrome = path.join(root, "chromium-1234", "chrome-linux64", "chrome");
      mkdirSync(path.dirname(fullChrome), { recursive: true });
      writeFileSync(fullChrome, "", { mode: 0o755 });
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
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("uses playwright-core's package-local cache when PLAYWRIGHT_BROWSERS_PATH=0", () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      const coreRoot = path.join(projectRoot, "node_modules", "playwright-core");
      const binary = path.join(
        coreRoot,
        ".local-browsers",
        "chromium_headless_shell-1234",
        "chrome-headless-shell-linux64",
        "chrome-headless-shell",
      );
      mkdirSync(path.dirname(binary), { recursive: true });
      writeFileSync(binary, "", { mode: 0o755 });
      writeFileSync(
        path.join(coreRoot, "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const result = playwrightBrowserRevisionCheck({
        projectRoot,
        env: { NODE_ENV: "test", PLAYWRIGHT_BROWSERS_PATH: "0" },
        platform: "linux",
        architecture: "x64",
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("installed");
      expect(result.binaryPath).toBe(binary);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("fails closed when the expected headless-shell path is a directory or a non-executable file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-not-executable-"));
    const projectRoot = mkdtempSync(path.join(tmpdir(), "pw-project-"));
    try {
      const binary = path.join(
        root,
        "chromium_headless_shell-1234",
        "chrome-headless-shell-linux64",
        "chrome-headless-shell",
      );
      mkdirSync(binary, { recursive: true });
      mkdirSync(path.join(projectRoot, "node_modules", "playwright-core"), { recursive: true });
      writeFileSync(
        path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
        JSON.stringify({ browsers: [{ name: "chromium", revision: "1234" }] }),
      );

      const directoryResult = playwrightBrowserRevisionCheck({
        projectRoot,
        env: { NODE_ENV: "test" },
        defaultManagedBrowsersRoot: root,
        platform: "linux",
        architecture: "x64",
      });
      expect(directoryResult.ok).toBe(false);
      expect(directoryResult.status).toBe("binary-missing");

      if (process.platform !== "win32") {
        rmSync(binary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        writeFileSync(binary, "", { mode: 0o644 });
        const nonExecutableResult = playwrightBrowserRevisionCheck({
          projectRoot,
          env: { NODE_ENV: "test" },
          defaultManagedBrowsersRoot: root,
          platform: "linux",
          architecture: "x64",
        });
        expect(nonExecutableResult.ok).toBe(false);
        expect(nonExecutableResult.status).toBe("binary-missing");
      }
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

  it("finds the actual headless-shell binary for a revision, not just its directory", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-find-binary-"));
    try {
      expect(findInstalledChromiumBinary(root, "1234", { platform: "linux", architecture: "x64" })).toBeNull();

      const binary = path.join(
        root,
        "chromium_headless_shell-1234",
        "chrome-headless-shell-linux64",
        "chrome-headless-shell",
      );
      mkdirSync(path.dirname(binary), { recursive: true });
      writeFileSync(binary, "", { mode: 0o755 });
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
