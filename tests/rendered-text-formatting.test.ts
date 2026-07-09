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
  // Answer/evidence render surfaces (SourceImage, SourcePreviewContent,
  // NaturalLanguageAnswer, QuoteCards, EvidenceMapTable, …) now live in extracted
  // modules. Scan them alongside the monolith so the raw-render guards travel with
  // the code as it moves out — assertions check the combined dashboard surfaces.
  const answerContent = componentSource("clinical-dashboard/answer-content.tsx");
  const evidenceContent = componentSource("clinical-dashboard/evidence-panels.tsx");
  // evidenceMapRowsFromRenderModel (the evidence-map row projection) was extracted here so the
  // dashboard can import it without the heavy evidence-panels chunk; scan it so its formatter
  // guard travels with the code.
  const evidenceMapModel = componentSource("clinical-dashboard/evidence-map-model.ts");
  const outputPanel = componentSource("clinical-dashboard/output-panel.tsx");
  const visualEvidence = componentSource("clinical-dashboard/visual-evidence.tsx");
  const documentResults = componentSource("clinical-dashboard/document-results.tsx");
  const answerResultSurface = componentSource("clinical-dashboard/answer-result-surface.tsx");
  const dashboardSurfaces = `${dashboard}\n${answerContent}\n${evidenceContent}\n${evidenceMapModel}\n${outputPanel}\n${visualEvidence}\n${documentResults}\n${answerResultSurface}`;

  it("renders exact quotes through the verbatim cleaner, never raw", () => {
    // Allow `${quote.quote}` inside template literals (React keys, clipboard text);
    // only a bare JSX child `{quote.quote}` is a raw-render regression.
    expect(dashboardSurfaces).not.toMatch(/(?<!\$)\{quote\.quote\}/);
    expect(dashboardSurfaces).toContain("sourceTextForVerbatimQuote(quote.quote)");
  });

  it("renders document titles through cleanDisplayTitle, never raw", () => {
    expect(dashboardSurfaces).not.toMatch(/\{source\.title\}/);
    expect(dashboardSurfaces).toContain("cleanDisplayTitle(");
  });

  it("renders extracted table snippets through a compact formatter, never raw", () => {
    expect(dashboardSurfaces).not.toMatch(/>\s*\{item\.tableTextSnippet\}\s*</);
    expect(dashboardSurfaces).toContain("sourceTextForCompactDisplay(item.tableTextSnippet)");
  });

  it("renders source-card snippets through compactSourceSnippet with the card title deduped", () => {
    expect(dashboardSurfaces).not.toMatch(/(?<!\$)\{source\.snippet\}/);
    expect(dashboardSurfaces).toContain('compactSourceSnippet(source.snippet ?? "", { dropTitle: source.title })');
  });

  it("renders evidence-map row details through the compact formatter, never raw", () => {
    expect(dashboardSurfaces).toContain("sourceTextForCompactDisplay(row.quote || row.source.snippet");
  });

  it("renders document-viewer image captions through a formatter, never raw", () => {
    expect(documentViewer).not.toMatch(/\{image\.caption\}/);
    expect(documentViewer).toContain("sourceTextForCompactDisplay(image.caption)");
  });

  it("renders visual-evidence titles and alt text through formatters, never raw", () => {
    expect(dashboardSurfaces).not.toMatch(/(?<!\$)\{item\.title\}/);
    expect(dashboardSurfaces).not.toMatch(/caption=\{item\.caption\}/);
  });

  it("cleans quotes for both display and clipboard through the verbatim cleaner", () => {
    // One call for the rendered blockquote, one for the copy-to-clipboard text.
    const cleanerCalls = dashboardSurfaces.match(/sourceTextForVerbatimQuote\(quote\.quote\)/g) ?? [];
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
