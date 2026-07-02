import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guard against regressions where document-derived text is interpolated raw into
// JSX instead of being routed through a source-text formatter. Each assertion
// pins a surface that previously leaked raw extraction artifacts (stray bullets,
// ligatures, image-data blocks, page codes) into the UI.

function componentSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), "src", "components", relativePath), "utf8");
}

describe("document-derived text must route through a formatter", () => {
  const dashboard = componentSource("ClinicalDashboard.tsx");
  const documentViewer = componentSource("DocumentViewer.tsx");

  it("renders exact quotes through the verbatim cleaner, never raw", () => {
    // Allow `${quote.quote}` inside template literals (React keys, clipboard text);
    // only a bare JSX child `{quote.quote}` is a raw-render regression.
    expect(dashboard).not.toMatch(/(?<!\$)\{quote\.quote\}/);
    expect(dashboard).toContain("sourceTextForVerbatimQuote(quote.quote)");
  });

  it("renders document titles through cleanDisplayTitle, never raw", () => {
    expect(dashboard).not.toMatch(/\{source\.title\}/);
    expect(dashboard).toContain("cleanDisplayTitle(");
  });

  it("renders extracted table snippets through a compact formatter, never raw", () => {
    expect(dashboard).not.toMatch(/>\s*\{item\.tableTextSnippet\}\s*</);
    expect(dashboard).toContain("sourceTextForCompactDisplay(item.tableTextSnippet)");
  });

  it("renders document-viewer image captions through a formatter, never raw", () => {
    expect(documentViewer).not.toMatch(/\{image\.caption\}/);
    expect(documentViewer).toContain("sourceTextForCompactDisplay(image.caption)");
  });

  it("renders visual-evidence titles and alt text through formatters, never raw", () => {
    expect(dashboard).not.toMatch(/(?<!\$)\{item\.title\}/);
    expect(dashboard).not.toMatch(/caption=\{item\.caption\}/);
  });

  it("cleans quotes for both display and clipboard through the verbatim cleaner", () => {
    // One call for the rendered blockquote, one for the copy-to-clipboard text.
    const cleanerCalls = dashboard.match(/sourceTextForVerbatimQuote\(quote\.quote\)/g) ?? [];
    expect(cleanerCalls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("citation labels repair extraction glyphs centrally", () => {
  it("citations.ts cleans titles before building any label", () => {
    const citations = readFileSync(resolve(process.cwd(), "src", "lib", "citations.ts"), "utf8");
    expect(citations).toContain("normalizeExtractedGlyphs");
    expect(citations).toMatch(/cleanCitationTitle\(citation\.title/);
  });
});
