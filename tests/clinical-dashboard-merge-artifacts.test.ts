import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
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
    ast: ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
});

const globalSearchShellSource = readFileSync(
  resolve(process.cwd(), "src/components/clinical-dashboard/global-search-shell.tsx"),
  "utf8",
);
const clinicalDashboardSource = readFileSync(resolve(process.cwd(), "src/components/ClinicalDashboard.tsx"), "utf8");
const globalStylesSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

type FoundDeclaration = { node: ts.FunctionDeclaration; ast: ts.SourceFile };

function findFunctionDeclaration(name: string): FoundDeclaration | null {
  for (const file of scannedFiles) {
    let found: ts.FunctionDeclaration | null = null;

    function visit(node: ts.Node) {
      if (found) return;
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
        found = node;
        return;
      }
      ts.forEachChild(node, visit);
    }

    visit(file.ast);
    if (found) return { node: found, ast: file.ast };
  }
  return null;
}

function descendantIdentifiers(node: ts.Node) {
  const identifiers = new Set<string>();

  function visit(current: ts.Node) {
    if (ts.isIdentifier(current)) identifiers.add(current.text);
    ts.forEachChild(current, visit);
  }

  visit(node);
  return identifiers;
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

  it("reserves phone space for the fixed mode-home composer", () => {
    expect(globalSearchShellSource).toContain("const mobileComposerReserve = !shouldShowSearchComposer");
    expect(globalSearchShellSource).not.toContain("const mobileComposerReserve = !reservesFloatingComposer");
  });

  it("does not reintroduce the obsolete output-mode copy helper", () => {
    expect(findFunctionDeclaration("clinicalOutputModeCopy")).toBeNull();
  });

  it("keeps the old ward-note controls out of ClinicalOutputPanel", () => {
    const panel = findFunctionDeclaration("ClinicalOutputPanel");
    expect(panel, "ClinicalOutputPanel should remain a local function declaration").not.toBeNull();
    if (!panel) throw new Error("ClinicalOutputPanel should remain a local function declaration");

    const panelSource = panel.node.getText(panel.ast);
    const panelIdentifiers = descendantIdentifiers(panel.node);

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

    const answerSource = answer.node.getText(answer.ast);
    expect(answerSource).toContain("plain-answer-prose");
    expect(answerSource).not.toContain("parseAnswerDisplayContent");
    expect(answerSource).not.toContain("AnswerSymbolTile");
    expect(answerSource).not.toContain("AnswerLineLabel");
  });
});
