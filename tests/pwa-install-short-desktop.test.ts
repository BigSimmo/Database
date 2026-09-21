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
});
