import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The phone contract, asserted as stylesheet rules rather than as rendered output.
 *
 * jsdom has no layout and applies no media query, so a DOM test cannot tell a sidebar that
 * disappears on a phone from one that does not. That gap is not hypothetical here: Ward Flow
 * shipped with the full 4.5rem desktop icon rail rendering unchanged on a 390px phone — 18% of
 * the viewport — through 38 test files and 428 passing tests, because nothing was structurally
 * wrong and no check ever looked at a width. The rules below are what make the phone treatment
 * exist at all, so they are what gets pinned.
 */
const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_ROOT = path.join(REPO_ROOT, "src", "components", "ward-management");

function readModule(relativePath: string) {
  // Normalised to LF: the repository enforces LF via .gitattributes, but a working tree that
  // has picked up CRLF must fail this suite on its content, never on its line endings.
  return readFileSync(path.join(WARD_ROOT, relativePath), "utf8").split("\r\n").join("\n");
}

/** Every Ward Flow stylesheet that lays out a whole screen around the sidebar. */
function shellStylesheets(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(WARD_ROOT, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const nested of readdirSync(path.join(WARD_ROOT, entry.name))) {
        if (nested.endsWith(".module.css")) found.push(`${entry.name}/${nested}`);
      }
    }
  }
  found.push("ward-management.module.css", "ward-management-modes.module.css");
  return found;
}

const shellFiles = shellStylesheets().filter((file) => readModule(file).includes("minmax(0, 1fr);"));

describe("Ward Flow sidebar — phone contract", () => {
  it("finds the shell stylesheets it is about to check (sanity check on the scan)", () => {
    // A broken scan would leave every assertion below vacuously true.
    expect(shellFiles.length).toBeGreaterThanOrEqual(9);
    expect(shellFiles).toContain("search/search.module.css");
    expect(shellFiles).toContain("ward-management-modes.module.css");
  });

  it("gives the sidebar its own grid track instead of a 4.5rem literal repeated per shell", () => {
    const literals = shellFiles.filter((file) => readModule(file).includes("grid-template-columns: 4.5rem"));
    expect(
      literals,
      `shell(s) still hard-coding the rail width instead of letting the sidebar own it: ${literals.join(", ")}`,
    ).toEqual([]);
  });

  it("hides the icon rail below 40rem, where the phone bar and drawer take over", () => {
    // The leading newline-and-indent matters: without it this also matches the long-standing
    // `.patientWorkspace .clinicalRail { display: none; }` rule further down the same file, and
    // the check passes with the rule it exists to protect deleted. Caught by mutation, not by
    // reading it.
    expect(readModule("ward-management.module.css")).toContain(
      "@media (max-width: 40rem) {\n  .clinicalRail {\n    display: none;\n  }\n}",
    );
  });

  it("shows the phone bar only below 40rem, and the labelled panel only from 64rem", () => {
    const sidebar = readModule("ward-sidebar.module.css");
    expect(sidebar).toContain("@media (max-width: 40rem) {\n  .phoneBar {\n    display: flex;\n  }\n}");
    expect(sidebar).toContain("@media (min-width: 64rem) {\n  .panel {\n    display: flex;\n  }\n}");
    // Default state for each, so a browser with no media-query support shows the rail alone
    // rather than three sidebars stacked.
    expect(sidebar).toContain(".phoneBar {\n  position: fixed;");
    expect(sidebar).toMatch(/\.panel \{\n {2}display: none;/);
  });

  it("reserves the fixed phone bar's height in every shell it floats above", () => {
    const missing = shellFiles.filter(
      (file) => !readModule(file).includes("padding-top: var(--spacing-ward-phone-bar);"),
    );
    expect(missing, `shell(s) whose content would sit under the fixed phone bar: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * Found in review, not by any check that existed at the time. The expanded panel is mounted at
   * every width and only hidden by CSS below 64rem, so a selector that keys off its presence must
   * be guarded by the same breakpoint — otherwise a tablet user with the expanded preference
   * stored sees the icon rail AND loses the header brand, leaving nothing on screen naming the
   * prototype.
   */
  it("suppresses the header brand only where the panel is actually visible", () => {
    const modes = readModule("ward-management-modes.module.css");
    const rule = ':global(aside[aria-label="Ward Flow sidebar"]) ~ .modeHeader .modeBrand';
    expect(modes).toContain(rule);
    const before = modes.slice(0, modes.indexOf(rule));
    const lastMediaOpen = before.lastIndexOf("@media");
    expect(lastMediaOpen, "the brand-hiding rule sits outside any media query").toBeGreaterThan(-1);
    expect(before.slice(lastMediaOpen)).toContain("min-width: 64rem");
    // Non-vacuity: the guard must not have been satisfied by an unrelated earlier media query that
    // was already closed before the rule.
    expect(before.slice(lastMediaOpen).split("}").length).toBeLessThan(4);
  });

  it("pushes each shell's own sticky header below the phone bar rather than under it", () => {
    // The two shells that have a sticky header of their own. Anything else has no header at all,
    // which is why the sidebar brings its own bar.
    for (const file of ["ward-management.module.css", "ward-management-modes.module.css"]) {
      const source = readModule(file);
      const phoneBlock = source.slice(source.indexOf("@media (max-width: 40rem)"));
      expect(phoneBlock, `${file} has a sticky header still pinned to the viewport top`).not.toContain(
        "position: sticky;\n    top: 0;",
      );
      expect(phoneBlock).toContain("top: var(--spacing-ward-phone-bar);");
    }
  });
});
