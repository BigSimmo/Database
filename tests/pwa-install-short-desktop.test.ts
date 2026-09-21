import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("short desktop install occlusion", () => {
  it("parks and compacts the install sheet on constrained desktop heights", () => {
    const styles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(styles).toContain("@media (min-width: 640px) and (max-height: 899.98px)");
    expect(styles).toContain(".pwa-install-sheet .pwa-install-compact-copy");
    expect(styles).toContain("max-height: min(42dvh");
    // Keep the existing answer-footer opposite-corner rule intact.
    expect(styles).toContain("body:has(form.answer-footer-search-edge) .pwa-notice-stack");
  });

  it("keeps bottom:auto on wide short viewports so 1280px rules cannot stretch notices", () => {
    const styles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    // Tall wide desktops may still use the lower-right bottom anchor.
    expect(styles).toContain("@media (min-width: 1280px) and (min-height: 900px)");
    // Wide short laptops (e.g. 1366×768) must reaffirm bottom:auto after any
    // width-only 1280px rules, and bound offline/update cards.
    expect(styles).toContain("@media (min-width: 1280px) and (max-height: 899.98px)");
    const wideShort = styles.split("@media (min-width: 1280px) and (max-height: 899.98px)")[1] ?? "";
    expect(wideShort).toContain("bottom: auto;");
    expect(wideShort).toContain(".pwa-lifecycle-card");
    expect(wideShort).toContain(".pwa-connection-restored");
  });
});
