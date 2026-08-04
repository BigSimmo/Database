import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(process.cwd(), "src/app/mockups/answer-evidence-popups/page.tsx"), "utf8");

function componentBody(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}(`);
  expect(start, `missing function ${functionName}`).toBeGreaterThanOrEqual(0);
  const nextFn = source.slice(start + 1).search(/\nfunction [A-Za-z]/);
  const end = nextFn === -1 ? source.length : start + 1 + nextFn;
  return source.slice(start, end);
}

describe("answer-evidence-popups heading hierarchy", () => {
  it("keeps Section titles at h2 and nested popup/sheet titles at h3 only", () => {
    // Gallery sections own the h2 outline; popup/sheet frames nest under them.
    // Promoting those child titles to h2 flattens the accessibility tree
    // (confirmed as a hierarchy regression on PR #1200).
    const section = componentBody(pageSource, "Section");
    expect(section).toContain('<h2 className="text-base font-semibold text-[color:var(--text-heading)]">{title}</h2>');
    expect(section).not.toMatch(/<h3\b/);

    for (const [name, titleSnippet] of [
      ["MobileSheetFrame", "{title}"],
      ["DesktopEvidenceModal", "Evidence"],
      ["TableDialog", "Clozapine monitoring table"],
      ["WeakEvidencePopup", "Evidence support is limited"],
    ] as const) {
      const body = componentBody(pageSource, name);
      expect(body, name).toMatch(new RegExp(`<h3\\b[^>]*>${titleSnippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h3>`));
      expect(body, `${name} must not use h2 titles`).not.toMatch(/<h2\b/);
    }
  });
});
