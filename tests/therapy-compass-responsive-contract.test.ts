import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const therapyPath = "src/components/therapy-compass";

const globalsSource = read("src/app/globals.css");
const controlsSource = read(`${therapyPath}/controls.ts`);
const therapyNavSource = read(`${therapyPath}/nav.tsx`);
const therapyCardSource = read(`${therapyPath}/therapy-card.tsx`);
const workspaceSource = read(`${therapyPath}/workspace.tsx`);
const homeSource = read(`${therapyPath}/screens/home-screen.tsx`);
const modeHomeComposerSource = read("src/lib/mode-home-composer.ts");
const modeHomeTemplateSource = read("src/components/mode-home-template.tsx");
const detailSource = read(`${therapyPath}/screens/detail-screen.tsx`);
const compareSource = read(`${therapyPath}/screens/compare-screen.tsx`);
const recommendSource = read(`${therapyPath}/screens/recommend-screen.tsx`);
const pathwaysSource = read(`${therapyPath}/screens/pathways-screen.tsx`);
const briefSource = read(`${therapyPath}/screens/brief-screen.tsx`);
const sheetsSource = read(`${therapyPath}/screens/sheets-screen.tsx`);
const otherSource = read(`${therapyPath}/screens/other-screen.tsx`);

/**
 * A fixed multi-column grid must collapse to a single column on phones via
 * Tailwind's mobile-first `grid-cols-1` + `sm:grid-cols-*`.
 */
function responsiveStackCount(source: string) {
  return source.match(/className="[^"]*\bgrid-cols-1\b[^"]*\bsm:grid-cols-/g)?.length ?? 0;
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
  it("retires the parallel stylesheet and uses the shared page canvas", () => {
    expect(existsSync(new URL(`../${therapyPath}/therapy-compass.css`, import.meta.url))).toBe(false);
    expect(workspaceSource).toContain("data-therapy-root");
    expect(workspaceSource).toContain("bg-[color:var(--background)]");
    expect(workspaceSource).not.toContain("var(--surface-chrome)");
    // The sideways-scrolling pill strip is retired: Therapy's nav is the shared
    // bar, which folds its overflow into a sheet rather than off the screen
    // edge. Its own density and centring contract lives in mode-nav-contract.
    expect(therapyNavSource).toContain("ModeNav");
    expect(therapyNavSource).not.toContain("overflow-x-auto");
    expect(therapyNavSource).not.toContain("w-fit");
    expect(globalsSource).toContain("position: relative;");
  });

  it("anchors the mode nav in the header collapse host", () => {
    expect(modeHomeComposerSource).toContain(
      'export const phoneHeaderCollapseAddonSlotId = "phone-header-collapse-addon-slot"',
    );
    // The portal is `ModeNavHeaderPortal`'s job now, not the mode's — it claims
    // the same slot at every width rather than only below the phone seam.
    expect(read("src/components/mode-nav/mode-nav-portal.tsx")).toContain("phoneHeaderCollapseAddonSlotId");
    expect(therapyNavSource).not.toContain("PhoneHeaderCollapsePortal");
  });

  it("puts every therapy screen on the shared content rail", () => {
    // Three rails used to disagree: header max-w-7xl, bar full-bleed, body on
    // bespoke 1240/1180px caps. `pageContainer` is the repo's canonical token.
    for (const [name, source] of [
      ["detail", detailSource],
      ["compare", compareSource],
      ["recommend", recommendSource],
      ["pathways", pathwaysSource],
      ["brief", briefSource],
      ["sheets", sheetsSource],
      ["other", otherSource],
    ] as const) {
      expect(source, `${name} screen`).toContain("pageContainer");
      expect(source, `${name} screen`).not.toContain("max-w-[1240px]");
      expect(source, `${name} screen`).not.toContain("max-w-[1180px]");
    }
    expect(workspaceSource).toContain("pageContainer");
    expect(workspaceSource).not.toContain("sm:px-10");
  });

  it("keeps phone reflow and comparison scroll residuals in globals.css", () => {
    expect(globalsSource).toMatch(/@media \(max-width: 640px\)/);
    expect(globalsSource).toContain(".therapy-compare-table");
    expect(globalsSource).toContain("overflow-x: auto !important;");
    expect(globalsSource).toContain("[data-therapy-scroll-sm]");
  });

  it("marks every fixed screen/card grid for phone reflow without changing its desktop template", () => {
    expect(responsiveStackCount(therapyCardSource)).toBeGreaterThanOrEqual(1);
    expect(homeSource).toContain("ModeHomeMain");
    expect(homeSource).toContain("ModeHomeTemplate");
    expect(modeHomeTemplateSource).toContain("sm:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]");
    expect(modeHomeTemplateSource).toContain("max-sm:border-t");
    expect(modeHomeTemplateSource).toContain("sm:rounded-lg sm:border");
    expect(modeHomeTemplateSource).not.toContain("lg:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]");
    expect(modeHomeTemplateSource).toContain("sm:flex-wrap");
    // The shared 8px gap keeps Therapy's five common searches on one 960px
    // row before and after the Geist font swap. A 10px desktop override made
    // the final row 961px, wrapped one pill, and produced desktop CLS 0.126.
    expect(modeHomeTemplateSource).not.toContain("sm:gap-2.5");
    expect(homeSource).toContain("desktopComposerSlotId={modeHomeDesktopComposerSlotId}");
    expect(homeSource).toContain("ModeHomeVerificationFooter");
    expect(responsiveStackCount(detailSource)).toBeGreaterThanOrEqual(1);
    expect(detailSource).toContain("max-sm:static");
    expect(
      responsiveStackCount(compareSource) + (compareSource.includes("therapy-compare-tabs") ? 1 : 0),
    ).toBeGreaterThanOrEqual(1);
    expect(compareSource).toContain("therapy-compare-tabs");
    expect(compareSource).toContain("therapy-compare-table");
    expect(compareSource).toContain("data-therapy-scroll-sm");
    expect(responsiveStackCount(recommendSource)).toBeGreaterThanOrEqual(1);
    expect(responsiveStackCount(pathwaysSource)).toBeGreaterThanOrEqual(1);
    expect(pathwaysSource).toContain("therapy-pathway-list");
    expect(responsiveStackCount(briefSource)).toBeGreaterThanOrEqual(1);
    expect(responsiveStackCount(sheetsSource)).toBeGreaterThanOrEqual(1);
    expect(sheetsSource).toContain("max-sm:static");
    expect(responsiveStackCount(otherSource)).toBeGreaterThanOrEqual(1);

    const allScreens = [
      therapyCardSource,
      detailSource,
      compareSource,
      recommendSource,
      pathwaysSource,
      briefSource,
      sheetsSource,
      otherSource,
    ].join("\n");
    expect(allScreens).toMatch(/sm:grid-cols-\[/);
  });

  it("renders the unavailable Favourite action honestly disabled", () => {
    const favouriteButton = therapyCardSource.match(
      /<button[\s\S]*?title="Favourite saving is not available yet"[\s\S]*?<\/button>/,
    )?.[0];

    expect(favouriteButton).toBeTruthy();
    // `aria-disabled` + the shared inert handler, not the native attribute: the
    // reason lives in the title, and `disabled` would take the only route to it
    // (the tab stop) away. The handler is what makes the control do nothing —
    // its presence is the contract, so this no longer asserts "no onClick".
    expect(favouriteButton).toContain('aria-disabled="true"');
    expect(favouriteButton).not.toMatch(/(^|\s)disabled(\s|=|$)/);
    expect(favouriteButton).toContain("onClick={ignoreUnavailableActivation}");
    expect(favouriteButton).toContain('aria-label="Favourite saving is not available yet"');
    expect(favouriteButton).toContain("cursor-not-allowed");
  });

  it("keeps search result cards dense: single-row tags, top favourite, clamped match cells", () => {
    expect(therapyCardSource).toContain("wrap={false}");
    expect(therapyCardSource).toContain("max={3}");
    expect(therapyCardSource).toContain("prioritiseTherapyTags");
    expect(therapyCardSource).toContain("cardPreviewText");
    expect(therapyCardSource).toContain("line-clamp-2");
    expect(therapyCardSource).toContain("grid-cols-3");
    // Favourite is pinned to the card corner; no heart-only desktop column.
    expect(therapyCardSource).toContain("absolute top-3 right-3");
    expect(therapyCardSource).not.toMatch(/sm:grid-cols-\[minmax\([^)]+\),1fr\)_minmax\([^)]+\),1\.35fr\)_auto\]/);
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

    const pickerTriggerTag = openingTagWith(sheetsSource, "button", ["aria-expanded={open}"]);
    expect(pickerTriggerTag).toBeTruthy();

    expect(globalsSource).toContain("[data-therapy-clinician-track]");
    expect(globalsSource).toContain("width: var(--spacing-tap);");
    expect(globalsSource).toContain("[data-therapy-clinician-track]::before");
    expect(sheetsSource).toContain("data-therapy-clinician-track");
  });

  it("scopes print hiding and page sizing to the mounted Therapy route", () => {
    const pageRuleStart = globalsSource.indexOf("@page therapy-compass-sheet");
    expect(pageRuleStart).toBeGreaterThanOrEqual(0);
    const printBlock = globalsSource.slice(pageRuleStart, pageRuleStart + 1200);

    expect(printBlock).toContain("body:has([data-therapy-root]) *");
    expect(printBlock).toContain("body:has([data-therapy-root]) [data-therapy-paper]");
    expect(printBlock).toContain("page: therapy-compass-sheet;");
    expect(printBlock).not.toMatch(/\n\s*body\s+\*/);
  });
});

describe("clinical accent contrast contract", () => {
  it("uses the semantic contrast token on every identified accent foreground", () => {
    const sources = [
      controlsSource,
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
    expect(controlsSource).toContain("text-[color:var(--clinical-accent-contrast)]");
    expect(homeSource).toContain("ModeHomeTemplate");
    expect(homeSource).not.toMatch(/background:var\(--clinical-accent\);color:#(?:fff|ffffff)/i);
    expect(homeSource).not.toMatch(/bg-\[color:var\(--clinical-accent\)\][^"\n]*\btext-white\b/);
    expect(pathwaysSource).not.toContain('? "#fff" : "var(--clinical-accent)"');
    expect(briefSource).not.toContain('? "#fff" : "var(--clinical-accent)"');
  });

  it("keeps the current dark accent/foreground token pair above text contrast", () => {
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
