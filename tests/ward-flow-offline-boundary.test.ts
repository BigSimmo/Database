import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { WARD_FLOW_OFFLINE_HEADER, WARD_FLOW_PATH_PREFIX, isWardFlowPath } from "@/lib/developer-area/headers";

const WARD_SOURCE_ROOTS = ["src/components/ward-management", "src/app/mockups/ward-flow"];

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function sourceFiles(): string[] {
  return WARD_SOURCE_ROOTS.flatMap(walk).filter((file) => /\.tsx?$/u.test(file));
}

function importsAndCalls(file: string): { imports: string[]; networkCalls: string[] } {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const networkCalls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === "fetch") ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ["send", "open"].includes(node.expression.name.text) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "XMLHttpRequest"))
    ) {
      networkCalls.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, networkCalls };
}

describe("Ward Flow's database-free runtime boundary", () => {
  it("matches the exact route subtree and exposes one trusted request marker", () => {
    expect(WARD_FLOW_PATH_PREFIX).toBe("/mockups/ward-flow");
    expect(WARD_FLOW_OFFLINE_HEADER).toBe("x-ward-flow-offline");
    expect(isWardFlowPath("/mockups/ward-flow")).toBe(true);
    expect(isWardFlowPath("/mockups/ward-flow/capacity")).toBe(true);
    expect(isWardFlowPath("/mockups/ward-flow-archive")).toBe(false);
    expect(isWardFlowPath("/documents")).toBe(false);
  });

  it("contains no database/provider import and makes no network call", () => {
    const violations: string[] = [];
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(50);

    for (const file of files) {
      const { imports, networkCalls } = importsAndCalls(file);
      for (const specifier of imports) {
        if (/supabase|site-content|clinical-registry|database/iu.test(specifier)) {
          violations.push(`${file} imports ${specifier}`);
        }
      }
      for (const call of networkCalls) violations.push(`${file} calls ${call}`);
    }

    expect(violations).toEqual([]);
  });

  it("uses the passwordless gate and keeps that gate free of Clinical KB authentication", () => {
    const layout = readFileSync("src/app/mockups/ward-flow/layout.tsx", "utf8");
    const boundaryFiles = [
      "src/components/developer-area/ward-flow-access-gate.tsx",
      "src/components/developer-area/ward-flow-key-gate-screen.tsx",
    ];

    expect(layout).toContain("WardFlowAccessGate");
    expect(layout).not.toContain("DeveloperAreaGate");
    for (const file of boundaryFiles) {
      const { imports, networkCalls } = importsAndCalls(file);
      expect(
        imports.filter((specifier) => /supabase|site-content|clinical-registry|database/iu.test(specifier)),
        file,
      ).toEqual([]);
      expect(networkCalls, file).toEqual([]);
    }
  });

  it("makes the root layout omit Clinical KB auth and account providers for the trusted marker", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain('requestHeaders.get(WARD_FLOW_OFFLINE_HEADER) === "1"');
    expect(layout).toContain("isOfflineWardFlow ? null : supabaseOrigin()");
    expect(layout).toMatch(/isOfflineWardFlow\s*\?\s*\(\s*<MobileKeyboardProvider>/u);
    expect(layout).toContain("<AuthProvider>");
    expect(layout).toContain("<AccountDataProvider>");
  });
});
