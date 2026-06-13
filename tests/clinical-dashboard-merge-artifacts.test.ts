import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const dashboardPath = resolve(process.cwd(), "src/components/ClinicalDashboard.tsx");
const dashboardSource = readFileSync(dashboardPath, "utf8");
const dashboardAst = ts.createSourceFile(
  dashboardPath,
  dashboardSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function findFunctionDeclaration(name: string): ts.FunctionDeclaration | null {
  let found: ts.FunctionDeclaration | null = null;

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(dashboardAst);
  return found;
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

    const panelSource = panel.getText(dashboardAst);
    const panelIdentifiers = descendantIdentifiers(panel);

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

    const answerSource = answer.getText(dashboardAst);
    expect(answerSource).toContain("plain-answer-prose");
    expect(answerSource).not.toContain("parseAnswerDisplayContent");
    expect(answerSource).not.toContain("AnswerSymbolTile");
    expect(answerSource).not.toContain("AnswerLineLabel");
  });
});
