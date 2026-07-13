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
const globalStylesSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

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
