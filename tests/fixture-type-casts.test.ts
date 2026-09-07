import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Domain model types where double casting (`as unknown as <Type>` or `as any as <Type>`)
 * suppresses compiler checking of fixture fields, hiding missing required fields or phantom fields.
 * (Target issues #WRZJVR and #AQXXD8).
 */
export const FORBIDDEN_DOMAIN_CAST_TARGETS = new Set([
  "BedRelease",
  "BedReleaseSummary",
  "BedReleaseRecord",
  "DischargeReadiness",
  "WardBed",
  "WardMovement",
]);

export interface DoubleCastFinding {
  file: string;
  line: number;
  targetType: string;
  expressionText: string;
}

/**
 * Parses TypeScript source code into an AST and detects double-casts (`as unknown as <Target>` or `as any as <Target>`)
 * onto forbidden domain model types.
 *
 * Comments are automatically ignored because AST traversal only inspects executable AsExpression nodes.
 */
export function findDoubleCastViolations(
  sourceCode: string,
  fileName: string,
  forbiddenTargets: Set<string> = FORBIDDEN_DOMAIN_CAST_TARGETS,
): DoubleCastFinding[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const findings: DoubleCastFinding[] = [];

  function isUnknownOrAny(typeNode: ts.TypeNode): boolean {
    return typeNode.kind === ts.SyntaxKind.UnknownKeyword || typeNode.kind === ts.SyntaxKind.AnyKeyword;
  }

  function getInnerAsExpression(node: ts.Expression): ts.AsExpression | null {
    if (ts.isAsExpression(node)) return node;
    if (ts.isParenthesizedExpression(node)) {
      return getInnerAsExpression(node.expression);
    }
    return null;
  }

  function visit(node: ts.Node) {
    if (ts.isAsExpression(node)) {
      const outerTargetType = node.type.getText(sourceFile).trim();
      const innerAs = getInnerAsExpression(node.expression);

      if (innerAs && isUnknownOrAny(innerAs.type)) {
        if (forbiddenTargets.has(outerTargetType)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          findings.push({
            file: fileName,
            line: line + 1,
            targetType: outerTargetType,
            expressionText: node.getText(sourceFile),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function collectTestFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        results.push(...collectTestFiles(fullPath));
      }
    } else if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("fixture type cast discipline (#WRZJVR / #AQXXD8)", () => {
  it("detects double-casts to forbidden domain models in sample code", () => {
    const sample = `
      const badFixture = { id: "123" } as unknown as BedRelease;
      const badAny = ({ id: "456" } as any) as BedRelease;
      // In comments: const ignored = {} as unknown as BedRelease;
      /* block comment: {} as unknown as BedRelease */
      const validDom = document.createElement("div") as unknown as HTMLElement;
      const validReq = {} as unknown as Request;
    `;

    const violations = findDoubleCastViolations(sample, "sample.ts");
    expect(violations).toHaveLength(2);
    expect(violations[0].targetType).toBe("BedRelease");
    expect(violations[0].line).toBe(2);
    expect(violations[1].targetType).toBe("BedRelease");
    expect(violations[1].line).toBe(3);
  });

  it("permits standard DOM and environment double-casts", () => {
    const sample = `
      const req = {} as unknown as Request;
      const res = {} as unknown as Response;
      const el = {} as unknown as HTMLElement;
      const obs = {} as unknown as IntersectionObserver;
    `;

    const violations = findDoubleCastViolations(sample, "sample.ts");
    expect(violations).toEqual([]);
  });

  it("ensures no test file across tests/ double-casts onto protected domain models", () => {
    const testFiles = collectTestFiles(join(process.cwd(), "tests"));
    expect(testFiles.length).toBeGreaterThan(10);

    const allViolations: DoubleCastFinding[] = [];
    for (const filePath of testFiles) {
      const code = readFileSync(filePath, "utf8");
      const relativePath = relative(process.cwd(), filePath).replace(/\\/g, "/");
      const violations = findDoubleCastViolations(code, relativePath);
      allViolations.push(...violations);
    }

    expect(
      allViolations,
      `Found double-cast violations on domain models (bypassing shape checks):\n` +
        allViolations.map((v) => `  ${v.file}:${v.line} -> ${v.targetType}`).join("\n"),
    ).toEqual([]);
  });
});
