import { globSync, readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = new URL("../src/", import.meta.url);
const CHIP_MODULE = "@/components/ui/chip";
const PRIMITIVES_MODULE = "@/components/ui-primitives";
const FORBIDDEN_CHIP_TOKEN =
  /(?:^|:)(?:bg-|border(?:-|$)|font-|h-|min-h-|max-h-|p[xy]?-(?:\d|\[)|rounded-|text-(?:2?xs|sm|base|lg|xl|\[color))/;
const FORBIDDEN_DENSITY_TOKEN = /(?:^|:)(?:h-|min-h-|max-h-|p[xy]?-(?:\d|\[)|text-(?:2?xs|sm|base|lg|xl))/;

type Evidence = { tokens: string[]; unresolved: string[] };

function importedBindings(sourceFile: ts.SourceFile, moduleName: string, exportName: string) {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== moduleName) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      if ((element.propertyName ?? element.name).text === exportName) bindings.add(element.name.text);
    }
  }
  return bindings;
}

function localInitializers(sourceFile: ts.SourceFile) {
  const initializers = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      initializers.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return initializers;
}

function addText(evidence: Evidence, text: string) {
  evidence.tokens.push(...text.split(/\s+/).filter(Boolean));
}

function collectClassEvidence(
  node: ts.Node | undefined,
  initializers: Map<string, ts.Expression>,
  evidence: Evidence = { tokens: [], unresolved: [] },
  seen = new Set<string>(),
): Evidence {
  if (!node) return evidence;
  if (ts.isStringLiteralLike(node)) {
    addText(evidence, node.text);
    return evidence;
  }
  if (ts.isIdentifier(node)) {
    if (["undefined", "null", "false", "true"].includes(node.text)) return evidence;
    const initializer = initializers.get(node.text);
    if (!initializer || seen.has(node.text)) {
      evidence.unresolved.push(node.text);
      return evidence;
    }
    seen.add(node.text);
    collectClassEvidence(initializer, initializers, evidence, seen);
    seen.delete(node.text);
    return evidence;
  }
  if (ts.isCallExpression(node)) {
    for (const argument of node.arguments) collectClassEvidence(argument, initializers, evidence, seen);
    return evidence;
  }
  if (ts.isConditionalExpression(node)) {
    collectClassEvidence(node.whenTrue, initializers, evidence, seen);
    collectClassEvidence(node.whenFalse, initializers, evidence, seen);
    return evidence;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    collectClassEvidence(node.right, initializers, evidence, seen);
    return evidence;
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    evidence.unresolved.push(node.getText());
    return evidence;
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        if (ts.isStringLiteralLike(property.name)) addText(evidence, property.name.text);
        else if (ts.isIdentifier(property.name)) addText(evidence, property.name.text);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        collectClassEvidence(property.name, initializers, evidence, seen);
      }
    }
    return evidence;
  }
  ts.forEachChild(node, (child) => collectClassEvidence(child, initializers, evidence, seen));
  return evidence;
}

function referencesBinding(
  node: ts.Node,
  bindings: Set<string>,
  initializers: Map<string, ts.Expression>,
  seen = new Set<string>(),
): boolean {
  if (ts.isIdentifier(node)) {
    if (bindings.has(node.text)) return true;
    const initializer = initializers.get(node.text);
    if (!initializer || seen.has(node.text)) return false;
    seen.add(node.text);
    const result = referencesBinding(initializer, bindings, initializers, seen);
    seen.delete(node.text);
    return result;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && referencesBinding(child, bindings, initializers, seen)) found = true;
  });
  return found;
}

function contractViolations(source: string, relativePath: string) {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const initializers = localInitializers(sourceFile);
  const chipBindings = importedBindings(sourceFile, CHIP_MODULE, "Chip");
  const metadataBindings = importedBindings(sourceFile, PRIMITIVES_MODULE, "metadataPill");
  const chip: string[] = [];
  const metadata: string[] = [];

  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
      const className = node.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "className",
      );
      const classExpression = className?.initializer
        ? ts.isJsxExpression(className.initializer)
          ? className.initializer.expression
          : className.initializer
        : undefined;

      if (chipBindings.has(node.tagName.text)) {
        if (classExpression) {
          const evidence = collectClassEvidence(classExpression, initializers);
          const forbidden = evidence.tokens.filter((token) => FORBIDDEN_CHIP_TOKEN.test(token));
          if (forbidden.length) chip.push(`${relativePath}: ${forbidden.join(" ")}`);
          if (evidence.unresolved.length) {
            chip.push(
              `${relativePath}: unresolved className expression ${[...new Set(evidence.unresolved)].join(" ")}`,
            );
          }
        }
      }

      if (classExpression && referencesBinding(classExpression, metadataBindings, initializers)) {
        const evidence = collectClassEvidence(classExpression, initializers);
        const forbidden = evidence.tokens.filter((token) => FORBIDDEN_DENSITY_TOKEN.test(token));
        if (forbidden.length) metadata.push(`${relativePath}: ${forbidden.join(" ")}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { chip, metadata };
}

let cachedProductionViolations: { chip: string[]; metadata: string[] } | undefined;

function productionViolations() {
  if (cachedProductionViolations) return cachedProductionViolations;
  const result = { chip: [] as string[], metadata: [] as string[] };
  for (const relativePath of globSync("**/*.{ts,tsx}", { cwd: sourceRoot })) {
    if (relativePath === "components/ui/chip.tsx") continue;
    const violations = contractViolations(readFileSync(new URL(relativePath, sourceRoot), "utf8"), relativePath);
    result.chip.push(...violations.chip);
    result.metadata.push(...violations.metadata);
  }
  cachedProductionViolations = result;
  return cachedProductionViolations;
}

describe("Chip call-site contract", () => {
  // Full-tree AST scan of every production source file; under coverage this
  // regularly exceeds the default 30s Vitest budget (observed 31s in CI).
  it("keeps imported Chip aliases and expression-valued className layout-only", { timeout: 90_000 }, () => {
    expect(productionViolations().chip).toEqual([]);
  });

  it("detects alias, resolved-variable, and unresolved-expression bypasses", () => {
    const source = `
      import { Chip as DesignChip } from "@/components/ui/chip";
      import { cn } from "@/components/ui-primitives";
      const paint = "bg-red-500";
      export function Bad({ external }: { external: string }) {
        return <><DesignChip className={cn("max-w-full", paint)}>Bad</DesignChip><DesignChip className={external}>Also bad</DesignChip></>;
      }
    `;
    expect(contractViolations(source, "fixture.tsx").chip).toEqual([
      "fixture.tsx: bg-red-500",
      "fixture.tsx: unresolved className expression external",
    ]);
  });

  it("uses named metadata density recipes instead of direct or variable overrides", { timeout: 90_000 }, () => {
    expect(productionViolations().metadata).toEqual([]);
  });

  it("detects metadataPill aliases with variable density overrides", () => {
    const source = `
      import { cn, metadataPill as pill, toneInfo } from "@/components/ui-primitives";
      const sizeClass = true ? "min-h-6 px-2 text-2xs" : "min-h-7 px-2 text-2xs";
      export const Bad = () => <span className={cn(pill, toneInfo, sizeClass)}>Bad</span>;
    `;
    expect(contractViolations(source, "fixture.tsx").metadata).toEqual([
      "fixture.tsx: min-h-6 px-2 text-2xs min-h-7 px-2 text-2xs",
    ]);
  });
});
