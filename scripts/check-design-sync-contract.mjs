import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "@typescript/typescript6";

const ROOT = process.cwd();
const CONFIG_PATH = ".design-sync/config.json";
const ENTRY_PATH = ".design-sync/entry.tsx";
const REQUIRED_GUIDELINES = [
  "docs/design-system/README.md",
  "docs/design-system/SPEC.md",
  "docs/design-system/TOKENS.md",
  "docs/design-system/COMPONENTS.md",
  "docs/design-system/DECISIONS.md",
  "docs/design-system/GATES.md",
  "docs/design-system/ADOPTION.md",
];

const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const hasFile = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));

function exportsFrom(relativePath) {
  const source = ts.createSourceFile(relativePath, read(relativePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set();
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      "name" in statement &&
      statement.name
    ) {
      names.add(statement.name.getText(source));
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text);
    }
  }
  return names;
}

function previewIsValid(name, config) {
  const relativePath = `.design-sync/previews/${name}.tsx`;
  if (!hasFile(relativePath)) return false;
  const source = ts.createSourceFile(relativePath, read(relativePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (source.parseDiagnostics.length > 0) return false;
  return new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']${config.pkg}["']`).test(
    read(relativePath),
  );
}

function declaredProps(relativePath, { typeName, functionName }) {
  const source = ts.createSourceFile(relativePath, read(relativePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const aliases = new Map(
    source.statements.filter(ts.isTypeAliasDeclaration).map((statement) => [statement.name.text, statement.type]),
  );
  const properties = new Set();
  const visitType = (typeNode, excluded = new Set()) => {
    if (ts.isTypeLiteralNode(typeNode)) {
      for (const member of typeNode.members) {
        if (ts.isPropertySignature(member) && member.name && !excluded.has(member.name.getText(source)))
          properties.add(member.name.getText(source));
      }
      return;
    }
    if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
      for (const type of typeNode.types) visitType(type, excluded);
      return;
    }
    if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
      const target = aliases.get(typeNode.typeName.text);
      const omitted = new Set(excluded);
      if (
        typeNode.typeName.text === "Omit" &&
        typeNode.typeArguments?.[1] &&
        ts.isUnionTypeNode(typeNode.typeArguments[1])
      ) {
        for (const item of typeNode.typeArguments[1].types) {
          if (ts.isLiteralTypeNode(item))
            omitted.add(ts.isStringLiteral(item.literal) ? item.literal.text : item.literal.getText(source));
        }
      }
      if (target) visitType(target, omitted);
      if (typeNode.typeName.text === "Omit" && typeNode.typeArguments?.[0])
        visitType(typeNode.typeArguments[0], omitted);
    }
  };
  if (typeName && aliases.has(typeName)) visitType(aliases.get(typeName));
  if (functionName) {
    const declaration = source.statements.find(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
    );
    const parameterType = declaration?.parameters[0]?.type;
    if (parameterType) visitType(parameterType);
  }
  return [...properties].sort();
}

function assertPublishedProps(config, failures) {
  // `dtsPropsFor` is the sync tool's string-only downstream format. These
  // requirements are derived from the TypeScript public props and fail closed if
  // a source addition is not represented in that downstream metadata.
  const requirements = {
    AnswerCard: ["ungrounded", "VerificationNoticeProps"],
    VerificationNotice: ["ungrounded", "attribution?:", "extractive"],
    EmptyState: ["headingLevel?: 2 | 3 | 4 | 5 | 6", "testId?: string"],
    TextField: ["id?:", "hint?: string", "error?: string", "fieldClassName?: string", "aria-describedby?: string"],
    SearchField: ["id?:", "onClear?:", "clearLabel?: string", "aria-describedby?: string"],
    Sheet: ["initialFocusRef?:", "returnFocusRef?:", "testId?: string", "id?: string"],
    AccessibleTable: ["normalizedTable?:"],
  };
  for (const [component, requiredSnippets] of Object.entries(requirements)) {
    const declaration = config.dtsPropsFor?.[component] ?? "";
    for (const snippet of requiredSnippets) {
      if (!declaration.includes(snippet))
        failures.push(`${component} dtsPropsFor omits source-derived public prop detail: ${snippet}`);
    }
  }
  const sourceDerived = {
    TextField: ["src/components/ui/text-field.tsx", { typeName: "TextFieldProps" }],
    SearchField: ["src/components/ui/text-field.tsx", { typeName: "SearchFieldProps" }],
    VerificationNotice: ["src/components/ui/verification-notice.tsx", { typeName: "VerificationNoticeProps" }],
    EmptyState: ["src/components/ui-primitives.tsx", { functionName: "EmptyState" }],
    Sheet: ["src/components/ui/sheet.tsx", { functionName: "Sheet" }],
    AccessibleTable: ["src/components/AccessibleTable.tsx", { functionName: "AccessibleTable" }],
  };
  for (const [component, [source, selector]] of Object.entries(sourceDerived)) {
    const declaration = config.dtsPropsFor?.[component] ?? "";
    for (const prop of declaredProps(source, selector)) {
      const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`${escaped}\\s*\\??:`).test(declaration))
        failures.push(`${component} dtsPropsFor omits source-derived public prop: ${prop}`);
    }
  }
}

function main() {
  const config = JSON.parse(read(CONFIG_PATH));
  const failures = [];
  if (JSON.stringify(config.guidelinesGlob) !== JSON.stringify(REQUIRED_GUIDELINES))
    failures.push("guidelinesGlob must enumerate the seven design-system documents in reading order");
  for (const guideline of REQUIRED_GUIDELINES)
    if (!hasFile(guideline)) failures.push(`missing guideline: ${guideline}`);

  const entry = read(ENTRY_PATH);
  const componentNames = Object.keys(config.componentSrcMap ?? {}).sort();
  const dtsNames = Object.keys(config.dtsPropsFor ?? {}).sort();
  if (JSON.stringify(componentNames) !== JSON.stringify(dtsNames))
    failures.push("componentSrcMap and dtsPropsFor must expose the same public components");

  for (const name of componentNames) {
    const source = config.componentSrcMap[name];
    if (!hasFile(source)) {
      failures.push(`${name} source is missing: ${source}`);
      continue;
    }
    if (!exportsFrom(source).has(name)) failures.push(`${name} is not exported by ${source}`);
    const isUiPrimitive = source === "src/components/ui-primitives.tsx";
    const entryExports =
      (isUiPrimitive && /export \* from ["']@\/components\/ui-primitives["']/.test(entry)) ||
      new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(entry);
    if (!entryExports) failures.push(`${name} is not exported by ${ENTRY_PATH}`);
    if (!previewIsValid(name, config))
      failures.push(`${name} preview is missing, malformed, or imports a different package`);
  }
  if (!/export type \{ AnswerState \} from ["']@\/components\/ui\/answer-state["']/.test(entry))
    failures.push("AnswerState is not exported as part of the design-sync public type surface");
  if (/sheet-focus/.test(entry)) failures.push("sheet-focus helpers must remain unpublished");
  assertPublishedProps(config, failures);

  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(
    `design-sync contract checked: ${componentNames.length} components and ${REQUIRED_GUIDELINES.length} guidelines\n`,
  );
}

main();
