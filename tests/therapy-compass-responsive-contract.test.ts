import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const therapyPath = "src/components/therapy-compass";

const therapyCssSource = read(`${therapyPath}/therapy-compass.css`);
const therapyCardSource = read(`${therapyPath}/therapy-card.tsx`);
const homeSource = read(`${therapyPath}/screens/home-screen.tsx`);
const modeHomeTemplateSource = read("src/components/mode-home-template.tsx");
const detailSource = read(`${therapyPath}/screens/detail-screen.tsx`);
const compareSource = read(`${therapyPath}/screens/compare-screen.tsx`);
const recommendSource = read(`${therapyPath}/screens/recommend-screen.tsx`);
const pathwaysSource = read(`${therapyPath}/screens/pathways-screen.tsx`);
const briefSource = read(`${therapyPath}/screens/brief-screen.tsx`);
const sheetsSource = read(`${therapyPath}/screens/sheets-screen.tsx`);
const otherSource = read(`${therapyPath}/screens/other-screen.tsx`);

function classCount(source: string, className: string) {
  return source.match(new RegExp(`className="[^"]*\\b${className}\\b[^"]*"`, "g"))?.length ?? 0;
}

function responsiveStackCount(source: string) {
  return classCount(source, "tc-mobile-stack") + classCount(source, "tc-stack-sm");
}

function openingTagWith(source: string, tagName: string, attributes: string[]) {
  const lookaheads = attributes
    .map((attribute) => `(?=[^>]*${attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`)
    .join("");
  return source.match(new RegExp(`<${tagName}${lookaheads}[^>]*>`))?.[0];
}

function contrastRatio(firstHex: string, secondHex: string) {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)!
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const lighter = Math.max(luminance(firstHex), luminance(secondHex));
  const darker = Math.min(luminance(firstHex), luminance(secondHex));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Therapy Compass responsive contract", () => {
  it("defines one scoped phone reflow and a local comparison scroller", () => {
    expect(therapyCssSource).toMatch(/@media \(max-width: 640px\)/);
    expect(therapyCssSource).toContain(".tc-root .tc-mobile-stack");
    expect(therapyCssSource).toContain("grid-template-columns: minmax(0, 1fr) !important;");
    expect(therapyCssSource).toContain(".tc-root .tc-mobile-grid-2");
    expect(therapyCssSource).toContain(".tc-root .tc-mobile-static");
    expect(therapyCssSource).toContain(".tc-root .tc-compare-table");
    expect(therapyCssSource).toContain("overflow-x: auto !important;");
  });

  it("marks every fixed screen/card grid for phone reflow without changing its desktop template", () => {
    expect(responsiveStackCount(therapyCardSource)).toBeGreaterThanOrEqual(2);
    expect(homeSource).toContain("ModeHomeMain");
    expect(homeSource).toContain("ModeHomeTemplate");
    expect(modeHomeTemplateSource).toContain("lg:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]");
    expect(modeHomeTemplateSource).toContain("sm:flex-wrap");
    expect(homeSource).toContain("desktopComposerSlotId={modeHomeDesktopComposerSlotId}");
    expect(homeSource).toContain("ModeHomeVerificationFooter");
    expect(responsiveStackCount(detailSource)).toBeGreaterThanOrEqual(2);
    expect(detailSource).toContain("tc-mobile-static");
    expect(responsiveStackCount(compareSource)).toBeGreaterThanOrEqual(1);
    expect(compareSource).toContain("tc-compare-tabs");
    expect(compareSource).toContain("tc-compare-table tc-scroll-sm");
    expect(responsiveStackCount(recommendSource)).toBeGreaterThanOrEqual(2);
    expect(responsiveStackCount(pathwaysSource)).toBeGreaterThanOrEqual(1);
    expect(pathwaysSource).toContain("tc-pathway-list");
    expect(responsiveStackCount(briefSource)).toBeGreaterThanOrEqual(2);
    expect(briefSource).toContain("tc-mobile-grid-2");
    expect(responsiveStackCount(sheetsSource)).toBeGreaterThanOrEqual(1);
    expect(sheetsSource).toContain("tc-builder-panel tc-mobile-static");
    expect(responsiveStackCount(otherSource)).toBeGreaterThanOrEqual(1);

    expect(therapyCssSource).toContain("grid-template-columns: minmax(280px, 1fr) minmax(400px, 1.35fr) auto");
    expect(therapyCssSource).toContain("grid-template-columns: minmax(0, 1fr) 344px");
    expect(therapyCssSource).toContain("grid-template-columns: 320px minmax(0, 1fr)");
    expect(therapyCssSource).toContain("grid-template-columns: 300px minmax(0, 1fr)");
    expect(therapyCssSource).toContain("grid-template-columns: 340px minmax(0, 1fr)");
  });

  it("renders the unavailable Favourite action honestly disabled", () => {
    const favouriteButton = therapyCardSource.match(
      /<button[\s\S]*?title="Favourite saving is not available yet"[\s\S]*?<\/button>/,
    )?.[0];

    expect(favouriteButton).toBeTruthy();
    expect(favouriteButton).toContain("disabled");
    expect(favouriteButton).toContain('aria-label="Favourite saving is not available yet"');
    expect(favouriteButton).toContain("tc-therapy-card-009");
    expect(therapyCssSource).toMatch(/\.tc-therapy-card-009\s*\{[\s\S]*?cursor:\s*not-allowed;/);
    expect(favouriteButton).not.toContain("onClick");
  });

  it("uses complete toggle semantics and preserves full-size control hit targets", () => {
    const briefGroupTag = openingTagWith(briefSource, "div", [
      'role="group"',
      'aria-label="Brief intervention duration"',
    ]);
    const compareGroupTag = openingTagWith(compareSource, "div", ['role="group"', 'aria-label="Comparison fields"']);
    expect(briefGroupTag).toBeTruthy();
    expect(compareGroupTag).toBeTruthy();

    for (const state of ['b.briefTab === "5min"', 'b.briefTab === "15min"', 'b.briefTab === "ground"']) {
      expect(openingTagWith(briefSource, "button", [`aria-pressed={${state}}`])).toBeTruthy();
    }
    for (const state of ['b.cmpTab === "priorities"', 'b.cmpTab === "differences"', 'b.cmpTab === "all"']) {
      expect(openingTagWith(compareSource, "button", [`aria-pressed={${state}}`])).toBeTruthy();
    }
    expect(briefSource).not.toContain('role="tab"');
    expect(briefSource).not.toContain("aria-selected=");
    expect(compareSource).not.toContain('role="tab"');
    expect(compareSource).not.toContain("aria-selected=");

    const pickerTriggerTag = openingTagWith(sheetsSource, "button", [
      'className="tc-btn tc-screens-sheets-screen-051"',
      "aria-expanded={open}",
    ]);
    expect(pickerTriggerTag).toBeTruthy();

    const clinicianTrackRule = therapyCssSource.match(/\.tc-clinician-track\s*\{([^}]*)\}/)?.[1] ?? "";
    const clinicianTrackVisualRule = therapyCssSource.match(/\.tc-clinician-track::before\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(clinicianTrackRule).toContain("width: var(--spacing-tap);");
    expect(clinicianTrackRule).toContain("height: var(--spacing-tap);");
    expect(clinicianTrackVisualRule).toContain("width: 42px;");
    expect(clinicianTrackVisualRule).toContain("height: 24px;");
  });

  it("scopes print hiding and page sizing to the mounted Therapy route", () => {
    const printBlock = therapyCssSource.slice(
      therapyCssSource.indexOf("@media print"),
      therapyCssSource.indexOf("/* Static screen rules"),
    );

    expect(printBlock).toContain("@page therapy-compass-sheet");
    expect(printBlock).toContain("body:has(.tc-root) *");
    expect(printBlock).toContain("body:has(.tc-root) .tc-paper");
    expect(printBlock).toContain("page: therapy-compass-sheet;");
    expect(printBlock).not.toMatch(/\n\s*body\s+\*/);
  });
});

describe("clinical accent contrast contract", () => {
  it("uses the semantic contrast token on every identified accent foreground", () => {
    const sources = [
      read(`${therapyPath}/controls.ts`),
      read(`${therapyPath}/ui.tsx`),
      recommendSource,
      pathwaysSource,
      briefSource,
      read("src/components/clinical-dashboard/answer-status.tsx"),
    ];

    for (const source of sources) {
      expect(source).not.toMatch(/background:var\(--clinical-accent\);color:#(?:fff|ffffff)/i);
      expect(source).not.toMatch(/bg-\[color:var\(--clinical-accent\)\][^"\n]*\btext-white\b/);
    }
    expect(therapyCssSource).toContain("color: var(--clinical-accent-contrast)");
    expect(homeSource).toContain("ModeHomeTemplate");
    expect(homeSource).not.toMatch(/background:var\(--clinical-accent\);color:#(?:fff|ffffff)/i);
    expect(homeSource).not.toMatch(/bg-\[color:var\(--clinical-accent\)\][^"\n]*\btext-white\b/);
    expect(pathwaysSource).not.toContain('? "#fff" : "var(--clinical-accent)"');
    expect(briefSource).not.toContain('? "#fff" : "var(--clinical-accent)"');
  });

  it("keeps the current dark accent/foreground token pair above text contrast", () => {
    const globalsSource = read("src/app/globals.css");
    const darkStart = globalsSource.indexOf(".dark {");
    const darkEnd = globalsSource.indexOf("\n}", darkStart);
    const darkTokens = globalsSource.slice(darkStart, darkEnd);
    const accent = darkTokens.match(/--primary-500:\s*(#[0-9a-f]{6})/i)?.[1];
    const foreground = darkTokens.match(/--clinical-accent-contrast:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(accent).toBeTruthy();
    expect(foreground).toBeTruthy();
    expect(contrastRatio(accent!, foreground!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("VisualEvidence unavailable-source semantics", () => {
  it("renders a non-link row when a source href is absent", () => {
    const source = read("src/components/clinical-dashboard/visual-evidence.tsx");

    expect(source).not.toContain('href={row.href ?? "#"}');
    expect(source).not.toContain("aria-disabled={!row.href}");
    expect(source).toContain("if (!row.href)");
    expect(source).toContain('data-testid="evidence-map-source-unavailable"');
    expect(source).toContain("Source unavailable");
    expect(source).toContain("href={row.href}");
    expect(source).toContain('data-testid="evidence-map-open-source"');
  });
});
