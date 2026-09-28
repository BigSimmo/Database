import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * CPD type weights (design standard v13 §1, CPD spec §5 "Type").
 *
 * Headings 600, names and row titles 500, body and numbers 400. Nothing on a
 * CPD page is ever bold, extrabold or black, and `--font-weight-value` (650)
 * is never used. A number is never heavier than 400 and never uppercase, so a
 * month total reads "9.5 h", not "9.5 H".
 *
 * A NUMBER ELEMENT is a JSX element whose own class list carries `nums` or
 * `tabular-nums`, or whose `data-testid` / `testId` ends in `-hours` or
 * `-total`. Its weight is its own last `font-*` weight class, or else the
 * nearest JSX ancestor's in the same file (CSS inherits it); the same goes for
 * `uppercase` / `normal-case`. Class strings are read through `cn(...)`,
 * template literals, local constants and the recipe constants CPD imports from
 * the shared recipe modules below, so `cn(eyebrowText, …)` counts as the 600
 * uppercase eyebrow it is.
 */

const ROOT = process.cwd();
const repoRelative = (file: string): string => relative(ROOT, file).replaceAll("\\", "/");
const CPD_DIRS = ["src/components/cme", "src/app/(search-app)/cme"];
const RECIPE_SOURCES: Readonly<Record<string, readonly string[]>> = {
  "@/components/ui-primitives": ["src/components/primitive-recipes"],
  "@/components/card-recipes": ["src/components/card-recipes.ts"],
  // Imported per file (`@/components/mode-kit/type`); scopeFor maps every `@/components/mode-kit/*` here.
  "@/components/mode-kit": ["src/components/mode-kit"],
};

const BANNED = /\bfont-(?:bold|extrabold|black)\b|--font-weight-value|\[font-weight:/;
const WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const TOO_HEAVY_FOR_A_NUMBER = new Set(["medium", "semibold", "bold", "extrabold", "black"]);

type Scope = ReadonlyMap<string, ts.Expression>;
type Context = { readonly weight: string | null; readonly upper: boolean };
type Finding = string;

function sourceFiles(target: string, extensions: readonly string[]): string[] {
  const absolute = resolve(ROOT, target);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [absolute];
  const out: string[] = [];
  for (const entry of readdirSync(absolute, { recursive: true, encoding: "utf8" })) {
    const full = join(absolute, entry);
    if (extensions.some((extension) => full.endsWith(extension)) && statSync(full).isFile()) out.push(full);
  }
  return out.sort();
}

function parse(file: string, text = readFileSync(file, "utf8")): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Every `const name = <expression>` in a file, exported or not. */
function constants(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
  const found = new Map<string, ts.Expression>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      found.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

const recipeScopes = new Map<string, Scope>(
  Object.entries(RECIPE_SOURCES).map(([moduleName, targets]) => {
    const merged = new Map<string, ts.Expression>();
    for (const target of targets) {
      for (const file of sourceFiles(target, [".ts", ".tsx"])) {
        for (const [name, expression] of constants(parse(file))) merged.set(name, expression);
      }
    }
    return [moduleName, merged] as const;
  }),
);

/** The file's own constants plus the recipe constants it imports by name. */
function scopeFor(sourceFile: ts.SourceFile): Scope {
  const scope = new Map(constants(sourceFile));
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    // The mode kit has no index file: `@/components/mode-kit/type`, `/recipes` and so on all read the kit's constants.
    const recipes =
      recipeScopes.get(specifier) ??
      (specifier.startsWith("@/components/mode-kit/") ? recipeScopes.get("@/components/mode-kit") : undefined);
    const named = statement.importClause?.namedBindings;
    if (!recipes || !named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      const expression = recipes.get((element.propertyName ?? element.name).text);
      if (expression) scope.set(element.name.text, expression);
    }
  }
  return scope;
}

function classTokens(node: ts.Node | undefined, scope: Scope, seen = new Set<string>()): string[] {
  if (!node) return [];
  if (ts.isStringLiteralLike(node)) return node.text.split(/\s+/).filter(Boolean);
  if (ts.isTemplateExpression(node)) {
    return [
      ...node.head.text.split(/\s+/),
      ...node.templateSpans.flatMap((span) => [
        ...classTokens(span.expression, scope, seen),
        ...span.literal.text.split(/\s+/),
      ]),
    ].filter(Boolean);
  }
  if (ts.isIdentifier(node)) {
    const expression = scope.get(node.text);
    if (!expression || seen.has(node.text)) return [];
    return classTokens(expression, scope, new Set([...seen, node.text]));
  }
  if (ts.isCallExpression(node)) return node.arguments.flatMap((argument) => classTokens(argument, scope, seen));
  if (ts.isConditionalExpression(node)) {
    return [...classTokens(node.whenTrue, scope, seen), ...classTokens(node.whenFalse, scope, seen)];
  }
  if (ts.isBinaryExpression(node)) {
    return node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ? classTokens(node.right, scope, seen)
      : [...classTokens(node.left, scope, seen), ...classTokens(node.right, scope, seen)];
  }
  if (ts.isParenthesizedExpression(node) || ts.isJsxExpression(node)) return classTokens(node.expression, scope, seen);
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((element) => classTokens(element, scope, seen));
  return [];
}

/** `sm:font-semibold!` -> `font-semibold`. */
function utility(token: string): string {
  return (token.split(":").pop() ?? token).replace(/^!|!$/g, "");
}

function attribute(opening: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name,
  );
}

function testIdTail(opening: ts.JsxOpeningLikeElement): string {
  const initializer = (attribute(opening, "data-testid") ?? attribute(opening, "testId"))?.initializer;
  if (!initializer) return "";
  if (ts.isStringLiteral(initializer)) return initializer.text;
  const expression = ts.isJsxExpression(initializer) ? initializer.expression : undefined;
  if (expression && ts.isStringLiteralLike(expression)) return expression.text;
  if (expression && ts.isTemplateExpression(expression)) {
    return expression.templateSpans.at(-1)?.literal.text ?? expression.head.text;
  }
  return "";
}

/** Number-element findings for one source file. */
function numberWeightFindings(sourceFile: ts.SourceFile): { findings: Finding[]; numbers: number } {
  const scope = scopeFor(sourceFile);
  const findings: Finding[] = [];
  let numbers = 0;
  const where = (node: ts.Node) =>
    `${repoRelative(sourceFile.fileName)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  const check = (opening: ts.JsxOpeningLikeElement, context: Context): Context => {
    const own = classTokens(attribute(opening, "className")?.initializer, scope).map(utility);
    const ownWeight =
      own
        .map((token) => WEIGHT.exec(token)?.[1])
        .filter(Boolean)
        .at(-1) ?? null;
    const lastCase = own.filter((token) => token === "uppercase" || token === "normal-case").at(-1);
    const next: Context = {
      weight: ownWeight ?? context.weight,
      upper: lastCase ? lastCase === "uppercase" : context.upper,
    };
    const isNumber =
      own.includes("nums") || own.includes("tabular-nums") || /-(?:hours|total)$/.test(testIdTail(opening));
    if (isNumber) {
      numbers += 1;
      if (next.weight && TOO_HEAVY_FOR_A_NUMBER.has(next.weight)) {
        findings.push(`${where(opening)} number at font-${next.weight}`);
      }
      if (next.upper) findings.push(`${where(opening)} number set in uppercase`);
    }
    return next;
  };

  const root: Context = { weight: null, upper: false };
  // JSX passed as a prop (`actions={<Button/>}`) renders somewhere else, so it
  // starts from nothing rather than inheriting from the element it is passed to.
  const visitAttributes = (opening: ts.JsxOpeningLikeElement) =>
    opening.attributes.properties.forEach((property) => visit(property, root));
  const visit = (node: ts.Node, context: Context): void => {
    if (ts.isJsxElement(node)) {
      const next = check(node.openingElement, context);
      visitAttributes(node.openingElement);
      node.children.forEach((child) => visit(child, next));
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      check(node, context);
      visitAttributes(node);
      return;
    }
    ts.forEachChild(node, (child) => visit(child, context));
  };
  visit(sourceFile, root);
  return { findings, numbers };
}

const cpdFiles = CPD_DIRS.flatMap((dir) => sourceFiles(dir, [".tsx"]));

describe("CPD type weights", () => {
  it("scans the CPD component and route folders", () => {
    expect(cpdFiles.length).toBeGreaterThan(30);
  });

  it("never uses font-bold, font-extrabold, font-black or --font-weight-value", () => {
    const offenders = cpdFiles.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => (BANNED.test(line) ? [`${repoRelative(file)}:${index + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it("sets every number at 400 and never in uppercase", () => {
    const results = cpdFiles.map((file) => numberWeightFindings(parse(file)));
    expect(results.reduce((sum, result) => sum + result.numbers, 0)).toBeGreaterThanOrEqual(8);
    expect(results.flatMap((result) => result.findings)).toEqual([]);
  });

  it("catches a number that inherits the eyebrow's weight and capitals, and passes the fixed form", () => {
    const fixture = (total: string) =>
      parse(
        resolve(ROOT, "src/components/cme/fixture.tsx"),
        `import { cn, eyebrowText } from "@/components/ui-primitives";
export function Month() {
  return (
    <h2 className={cn(eyebrowText, "flex")}>
      <span>September 2026</span>
      ${total}
    </h2>
  );
}`,
      );
    expect(numberWeightFindings(fixture('<span className="tabular-nums">9.5 h</span>')).findings).toEqual([
      "src/components/cme/fixture.tsx:6 number at font-semibold",
      "src/components/cme/fixture.tsx:6 number set in uppercase",
    ]);
    expect(
      numberWeightFindings(fixture('<span className="nums font-normal normal-case">9.5 h</span>')).findings,
    ).toEqual([]);
  });
});
