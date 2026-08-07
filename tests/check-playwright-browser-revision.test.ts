import { describe, expect, it } from "vitest";
import {
  listInstalledChromiumRevisions,
  playwrightBrowserRevisionCheck,
  readExpectedChromiumRevision,
} from "../scripts/check-playwright-browser-revision.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("check-playwright-browser-revision", () => {
  it("reads the chromium revision from the installed playwright-core browsers.json", () => {
    const expected = readExpectedChromiumRevision(process.cwd());
    expect(expected.ok).toBe(true);
    expect(expected.revision).toMatch(/^\d+$/);
  });

  it("passes when no designated container browser root is forced", () => {
    const result = playwrightBrowserRevisionCheck({
      env: {},
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("managed-or-unconstrained");
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

  it("lists installed chromium revisions from a browsers root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pw-list-"));
    mkdirSync(path.join(root, "chromium-1234"));
    mkdirSync(path.join(root, "chromium_headless_shell-1234"));
    mkdirSync(path.join(root, "firefox-1000"));
    expect(listInstalledChromiumRevisions(root)).toEqual(["1234"]);
  });
});
