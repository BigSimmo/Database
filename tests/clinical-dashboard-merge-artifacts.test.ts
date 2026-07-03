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
