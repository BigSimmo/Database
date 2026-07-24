import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

// The dashboard render surfaces are progressively being extracted from the
// monolith into src/components/clinical-dashboard/*. Scan every file that now
// owns a pinned declaration so the guards travel with the code and the
// absence checks strengthen across the whole set.
const scannedFiles = [
  "src/components/ClinicalDashboard.tsx",
  "src/components/clinical-dashboard/answer-content.tsx",
  "src/components/clinical-dashboard/output-panel.tsx",
].map((relativePath) => {
  const path = resolve(process.cwd(), relativePath);
  const source = readFileSync(path, "utf8");
  return {
    path,
    source,
    ast: parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    }),
  };
});

const globalSearchShellSource = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
  "utf8",
);
const clinicalDashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
const documentViewerSource = readFileSync(resolve(process.cwd(), "src/components/DocumentViewer.tsx"), "utf8");
const globalStylesSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const uiPrimitivesSource = readFileSync(resolve(process.cwd(), "src/components/ui-primitives.tsx"), "utf8");
const differentialsHomeSource = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/differentials-home.tsx"),
  "utf8",
);
const applicationsLauncherSource = readFileSync(
  resolve(process.cwd(), "src/components/applications-launcher-page.tsx"),
  "utf8",
);
const serviceDetailSource = readFileSync(
  resolve(process.cwd(), "src/components/services/service-detail-page.tsx"),
  "utf8",
);
const formDetailSource = readFileSync(resolve(process.cwd(), "src/components/forms/form-detail-page.tsx"), "utf8");
const specifierUiSource = readFileSync(resolve(process.cwd(), "src/components/specifiers/specifier-ui.tsx"), "utf8");
const formulationUiSource = readFileSync(
  resolve(process.cwd(), "src/components/formulation/formulation-ui.tsx"),
  "utf8",
);
const favouritesLibrarySource = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/favourites-command-library-page.tsx"),
  "utf8",
);
const mobileComposerReserveSource = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/mobile-composer-reserve.ts"),
  "utf8",
);

type FoundDeclaration = { source: string };

function findFunctionDeclaration(name: string): FoundDeclaration | null {
  for (const file of scannedFiles) {
    let found: string | null = null;
    const visit = (node: unknown) => {
      if (found || !node || typeof node !== "object") return;
      const current = node as Record<string, unknown>;
      const identifier = current.id as Record<string, unknown> | undefined;
      if (
        current.type === "FunctionDeclaration" &&
        identifier?.type === "Identifier" &&
        identifier.name === name &&
        typeof current.start === "number" &&
        typeof current.end === "number"
      ) {
        found = file.source.slice(current.start, current.end);
        return;
      }
      for (const value of Object.values(current)) {
        if (Array.isArray(value)) value.forEach(visit);
        else visit(value);
      }
    };
    visit(file.ast);
    if (found) return { source: found };
  }
  return null;
}

function descendantIdentifiers(source: string) {
  return new Set(source.match(/\b[A-Za-z_$][\w$]*\b/g) ?? []);
}

describe("ClinicalDashboard merge-artifact guards", () => {
  it("keeps the mode-home composer continuous across the desktop breakpoint", () => {
    expect(globalStylesSource.match(/clamp\(28rem, 50vw, 48rem\)/g)).toHaveLength(2);
    expect(globalStylesSource).not.toContain("clamp(34rem, 50vw, 48rem)");
  });

  it("keeps a mobile height floor for centered mode homes", () => {
    expect(clinicalDashboardSource).toContain("max-sm:min-h-[calc(100dvh-12.5rem)]");
    expect(clinicalDashboardSource).not.toContain("max-sm:min-h-0 max-sm:flex-1");
  });

  it("never hand-authors -webkit-backdrop-filter declarations", () => {
    // Writing the prefixed duplicate in source makes Lightning CSS drop the
    // whole backdrop-filter property group (the tint-only-glass bug); the
    // pipeline auto-generates the -webkit- pair for Safari <= 17 from the
    // unprefixed declaration alone. Feature probes inside @supports
    // conditions are fine — only declarations (line-leading property) are
    // rejected. See the authoring rule beside .edge-glass-header-backdrop.
    expect(globalStylesSource).not.toMatch(/^\s*-webkit-backdrop-filter\s*:/m);
  });

  it("releases the Safari toolbar reserve only after phone composers hide", () => {
    expect(mobileComposerReserveSource).toContain('export const mobileComposerHiddenReserve = "0rem"');
    expect(mobileComposerReserveSource).toContain(
      'export const mobileComposerDifferentialsCompareReserve = "calc(12.5rem + var(--safe-area-bottom))"',
    );
    expect(mobileComposerReserveSource).toContain("export function resolveMobileComposerReserve");
    expect(mobileComposerReserveSource).toContain("export function isDocumentViewerOwnedRoute");
    expect(mobileComposerReserveSource).not.toContain("env(safe-area-inset-bottom)");

    expect(globalSearchShellSource).toContain("resolveShellVisibleMobileComposerReserve");
    expect(globalSearchShellSource).toContain("resolveMobileComposerReserve(");
    expect(globalSearchShellSource).toContain('from "@/components/clinical-dashboard/mobile-composer-reserve"');
    expect(globalSearchShellSource).not.toContain('bottomComposerHidden ? "max(0.75rem, env(safe-area-inset-bottom))"');
    expect(globalSearchShellSource).not.toContain('bottomComposerHidden ? "max(0.75rem, var(--safe-area-bottom))"');
    expect(globalSearchShellSource).not.toContain('"max(2rem, var(--safe-area-bottom))"');
    expect(globalSearchShellSource).not.toContain("const mobileComposerReserve = !reservesFloatingComposer");
    expect(globalSearchShellSource).not.toContain("const mobileComposerReserve = phoneScrollHide.hidden");
    expect(globalSearchShellSource).toContain("sm:pb-[calc(9rem+var(--safe-area-bottom))]");
    expect(globalSearchShellSource).not.toContain("sm:pb-[calc(9rem+env(safe-area-inset-bottom))]");
    // Phone shell clearance is an inner pad so padding contributes to scrollHeight.
    expect(globalSearchShellSource).toContain('data-testid="mobile-composer-reserve-pad"');
    expect(globalSearchShellSource).toContain("max-sm:pb-[var(--mobile-composer-reserve)]");
    expect(globalSearchShellSource).not.toContain('data-testid="mobile-composer-reserve-spacer"');

    expect(clinicalDashboardSource).toContain("resolveDashboardVisibleMobileComposerReserve");
    expect(clinicalDashboardSource).toContain("resolveMobileComposerReserve(");
    expect(clinicalDashboardSource).toContain('from "@/components/clinical-dashboard/mobile-composer-reserve"');
    expect(clinicalDashboardSource).not.toContain('bottomComposerHidden ? "max(0.75rem, env(safe-area-inset-bottom))"');
    expect(clinicalDashboardSource).toContain(
      '"max-sm:pb-[var(--mobile-composer-reserve)] max-sm:[scroll-padding-bottom:var(--mobile-composer-reserve)] sm:mb-24"',
    );
    expect(clinicalDashboardSource).toContain(
      '"max-sm:pb-[var(--mobile-composer-reserve)] max-sm:[scroll-padding-bottom:var(--mobile-composer-reserve)] sm:mb-0"',
    );

    expect(documentViewerSource).toContain('data-testid="document-viewer-content"');
    expect(documentViewerSource).toContain('"max-sm:pb-0"');
    expect(documentViewerSource).toContain('"max-sm:pb-[calc(9rem+var(--safe-area-bottom))]"');
    // Hidden document content must not reintroduce Safari toolbar inset padding.
    expect(documentViewerSource).not.toMatch(/composerScrollHidden\s*\?\s*["']max-sm:pb-\[calc\([^"']*safe-area/);
    expect(documentViewerSource).toContain("max-sm:duration-[240ms]");
    expect(documentViewerSource).toContain("max-sm:ease-[cubic-bezier(0.4,0,0.2,1)]");
    expect(globalStylesSource).toContain("@media (max-width: 639px) and (prefers-reduced-motion: reduce)");
    expect(globalStylesSource).toContain('#main-content[data-bottom-composer-hidden="true"]');
    expect(globalStylesSource).toContain('[data-testid="mobile-composer-reserve-pad"]');
    expect(globalStylesSource).toContain("--phone-dock-differentials-compare-clearance: 12.5rem");
    expect(globalStylesSource).toContain("var(--phone-dock-differentials-compare-clearance)");
    // Child pages must not stack a second dock-sized safe-area pad under the
    // shared host reserve — that pad cannot collapse when the dock hides.
    expect(uiPrimitivesSource).not.toContain("pb-[calc(12rem+env(safe-area-inset-bottom))]");
    expect(differentialsHomeSource).not.toContain("pb-[calc(12.5rem+env(safe-area-inset-bottom))]");
    expect(applicationsLauncherSource).not.toContain("pb-[calc(12rem+env(safe-area-inset-bottom))]");
    expect(serviceDetailSource).not.toContain("pb-[calc(5.5rem+env(safe-area-inset-bottom))]");
    expect(serviceDetailSource).toContain("max-sm:min-h-0");
    expect(formDetailSource).not.toContain("pb-[calc(2rem+env(safe-area-inset-bottom))]");
    expect(formDetailSource).toContain("max-sm:min-h-0");
    expect(specifierUiSource).not.toContain("pb-[calc(7rem+env(safe-area-inset-bottom))]");
    expect(specifierUiSource).toContain("max-sm:min-h-0");
    expect(formulationUiSource).not.toContain("pb-[calc(7rem+env(safe-area-inset-bottom))]");
    expect(formulationUiSource).toContain("max-sm:min-h-0");
    expect(favouritesLibrarySource).not.toContain("pb-[calc(6rem+env(safe-area-inset-bottom))]");
    expect(globalStylesSource).toContain("--phone-dock-hidden-pad: 0rem");
  });

  it("does not reintroduce the obsolete output-mode copy helper", () => {
    expect(findFunctionDeclaration("clinicalOutputModeCopy")).toBeNull();
  });

  it("keeps the old ward-note controls out of ClinicalOutputPanel", () => {
    const panel = findFunctionDeclaration("ClinicalOutputPanel");
    expect(panel, "ClinicalOutputPanel should remain a local function declaration").not.toBeNull();
    if (!panel) throw new Error("ClinicalOutputPanel should remain a local function declaration");

    const panelSource = panel.source;
    const panelIdentifiers = descendantIdentifiers(panel.source);

    expect(panelIdentifiers.has("copiedWardNote")).toBe(false);
    expect(panelIdentifiers.has("onCopyWardNote")).toBe(false);
    expect(panelIdentifiers.has("demoMode")).toBe(false);
    expect(panelSource).not.toContain("Copy clinical draft");
    expect(panelSource).not.toContain("Synthetic demo only: this is not clinical guidance.");
  });

  it("keeps the primary answer as simple prose instead of parsed icon rows", () => {
    expect(findFunctionDeclaration("PrimaryAnswerContent")).toBeNull();

    const answer = findFunctionDeclaration("NaturalLanguageAnswer");
    expect(answer, "NaturalLanguageAnswer should remain a local function declaration").not.toBeNull();
    if (!answer) throw new Error("NaturalLanguageAnswer should remain a local function declaration");

    const answerSource = answer.source;
    expect(answerSource).toContain("plain-answer-prose");
    expect(answerSource).not.toContain("parseAnswerDisplayContent");
    expect(answerSource).not.toContain("AnswerSymbolTile");
    expect(answerSource).not.toContain("AnswerLineLabel");
  });
});
