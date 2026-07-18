import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const therapyPath = "src/components/therapy-compass";

const stylesSource = read(`${therapyPath}/styles.tsx`);
const therapyCardSource = read(`${therapyPath}/therapy-card.tsx`);
const homeSource = read(`${therapyPath}/screens/home-screen.tsx`);
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
    expect(stylesSource).toMatch(/@media \(max-width: 640px\)/);
    expect(stylesSource).toContain(".tc-root .tc-mobile-stack { grid-template-columns: minmax(0, 1fr) !important; }");
    expect(stylesSource).toContain(".tc-root .tc-mobile-grid-2");
    expect(stylesSource).toContain(".tc-root .tc-mobile-static");
    expect(stylesSource).toContain(".tc-root .tc-home-search");
    expect(stylesSource).toContain(".tc-root .tc-compare-table");
    expect(stylesSource).toContain("overflow-x: auto !important;");
  });

  it("marks every fixed screen/card grid for phone reflow without changing its desktop template", () => {
    expect(responsiveStackCount(therapyCardSource)).toBeGreaterThanOrEqual(2);
    expect(responsiveStackCount(homeSource)).toBeGreaterThanOrEqual(3);
    expect(homeSource).toContain('className="tc-home-search"');
    expect(homeSource).toContain("tc-home-search-button");
    expect(responsiveStackCount(detailSource)).toBeGreaterThanOrEqual(2);
    expect(detailSource).toContain('className="tc-mobile-static"');
    expect(responsiveStackCount(compareSource)).toBeGreaterThanOrEqual(1);
    expect(compareSource).toContain('className="tc-compare-tabs"');
    expect(compareSource).toMatch(/className="(?:tc-compare-table tc-scroll|tc-scroll-sm)"/);
    expect(responsiveStackCount(recommendSource)).toBeGreaterThanOrEqual(2);
    expect(responsiveStackCount(pathwaysSource)).toBeGreaterThanOrEqual(1);
    expect(pathwaysSource).toContain('className="tc-pathway-list"');
    expect(responsiveStackCount(briefSource)).toBeGreaterThanOrEqual(2);
    expect(briefSource).toContain('className="tc-mobile-grid-2"');
    expect(responsiveStackCount(sheetsSource)).toBeGreaterThanOrEqual(1);
    expect(sheetsSource).toContain("tc-builder-panel tc-mobile-static");
    expect(responsiveStackCount(otherSource)).toBeGreaterThanOrEqual(1);

    expect(therapyCardSource).toContain("grid-template-columns:minmax(280px,1fr) minmax(400px,1.35fr) auto");
    expect(detailSource).toContain("grid-template-columns:minmax(0,1fr) 344px");
    expect(pathwaysSource).toContain("grid-template-columns:320px minmax(0,1fr)");
    expect(briefSource).toContain("grid-template-columns:300px minmax(0,1fr)");
    expect(sheetsSource).toContain("grid-template-columns:340px minmax(0,1fr)");
  });

  it("renders the unavailable Favourite action honestly disabled", () => {
    const favouriteButton = therapyCardSource.match(
      /<button[\s\S]*?title="Favourite saving is not available yet"[\s\S]*?<\/button>/,
    )?.[0];

    expect(favouriteButton).toBeTruthy();
    expect(favouriteButton).toContain("disabled");
    expect(favouriteButton).toContain('aria-label="Favourite saving is not available yet"');
    expect(favouriteButton).toContain("cursor:not-allowed");
    expect(favouriteButton).not.toContain("onClick");
  });
});

describe("clinical accent contrast contract", () => {
  it("uses the semantic contrast token on every identified accent foreground", () => {
    const sources = [
      read(`${therapyPath}/controls.ts`),
      read(`${therapyPath}/ui.tsx`),
      homeSource,
      recommendSource,
      pathwaysSource,
      briefSource,
      read("src/components/clinical-dashboard/answer-status.tsx"),
    ];

    for (const source of sources) {
      expect(source).not.toMatch(/background:var\(--clinical-accent\);color:#(?:fff|ffffff)/i);
      expect(source).not.toMatch(/bg-\[color:var\(--clinical-accent\)\][^"\n]*\btext-white\b/);
      expect(source).toContain("clinical-accent-contrast");
    }
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
