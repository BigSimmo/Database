import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "src/app/mockups/answer-evidence-popups/page.tsx"), "utf8");

describe("answer-evidence-popups heading hierarchy", () => {
  it("keeps Section titles at h2 and nested popup/sheet titles at h3", () => {
    // Gallery sections own the h2 outline; popup/sheet frames nest under them.
    // Promoting those child titles to h2 flattens the accessibility tree
    // (confirmed as a hierarchy regression on PR #1200).
    expect(pageSource).toMatch(
      /function Section\([\s\S]*?<h2 className="text-base font-semibold text-\[color:var\(--text-heading\)\]">\{title\}<\/h2>/,
    );
    expect(pageSource).toMatch(
      /function MobileSheetFrame\([\s\S]*?<h3 className="text-base font-semibold text-\[color:var\(--text-heading\)\]">\{title\}<\/h3>/,
    );
    expect(pageSource).toMatch(
      /function DesktopEvidenceModal\([\s\S]*?<h3 className="text-base font-semibold text-\[color:var\(--text-heading\)\]">Evidence<\/h3>/,
    );
    expect(pageSource).toMatch(
      /function TableDialog\([\s\S]*?<h3 className="text-base font-semibold text-\[color:var\(--text-heading\)\]">Clozapine monitoring table<\/h3>/,
    );
    expect(pageSource).toMatch(
      /function WeakEvidencePopup\([\s\S]*?<h3 className="text-sm font-semibold text-\[color:var\(--text-heading\)\]">Evidence support is limited<\/h3>/,
    );
  });
});
