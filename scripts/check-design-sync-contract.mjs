import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "@typescript/typescript6";

import { deriveDesignSyncProps } from "./generate-design-sync-contract.mjs";

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

function resolveRelativeModule(importer, specifier) {
  let candidate;
  if (specifier.startsWith("@/")) candidate = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith("."))
    candidate = path.posix.normalize(`${path.posix.dirname(importer.replaceAll("\\", "/"))}/${specifier}`);
  else return null;
  const candidates = path.extname(candidate)
    ? [candidate]
    : [`${candidate}.ts`, `${candidate}.tsx`, `${candidate}/index.ts`, `${candidate}/index.tsx`];
  return candidates.find((entry) => hasFile(entry)) ?? null;
}

function exportsFrom(relativePath, seen = new Set()) {
  if (seen.has(relativePath) || !hasFile(relativePath)) return new Set();
  seen.add(relativePath);
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
    if (!ts.isExportDeclaration(statement)) continue;
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text);
      continue;
    }
    if (!statement.exportClause && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const resolved = resolveRelativeModule(relativePath, statement.moduleSpecifier.text);
      if (resolved) for (const name of exportsFrom(resolved, seen)) names.add(name);
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

export function previewTypeFailures(componentNames, config, { root = ROOT } = {}) {
  const configPath = path.join(root, config.tsconfig);
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, ts.sys);
  if (!parsed) return [`unable to parse ${configPath} for preview validation`];
  const canonicalPath = (fileName) => path.resolve(fileName).replaceAll("\\", "/").toLowerCase();
  const previewRoot = "/.design-sync/previews/";
  const expectedPreviews = new Set(
    componentNames.map((name) => canonicalPath(path.join(root, ".design-sync", "previews", `${name}.tsx`))),
  );
  const configuredPreviews = new Set(
    parsed.fileNames.map(canonicalPath).filter((fileName) => fileName.includes(previewRoot)),
  );
  const configFailures = parsed.errors.map(
    (diagnostic) => `${config.tsconfig}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
  );
  const missingPreviews = [...expectedPreviews]
    .filter((fileName) => !configuredPreviews.has(fileName))
    .map((fileName) => `${fileName} is not included by ${config.tsconfig}`);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  return configFailures.concat(
    missingPreviews,
    ts.getPreEmitDiagnostics(program).map((diagnostic) => {
      const file = diagnostic.file;
      const position = file && diagnostic.start != null ? file.getLineAndCharacterOfPosition(diagnostic.start) : null;
      const location = file
        ? `${path.relative(root, file.fileName)}${position ? `:${position.line + 1}:${position.character + 1}` : ""}`
        : "design-sync preview compiler";
      return `${location}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    }),
  );
}

function main() {
  const config = JSON.parse(read(CONFIG_PATH));
  const failures = [];
  if (config.tsconfig !== ".design-sync/tsconfig.previews.json")
    failures.push("design-sync must use the committed preview TypeScript configuration");
  if (!hasFile(config.tsconfig)) failures.push(`missing preview TypeScript configuration: ${config.tsconfig}`);
  if (JSON.stringify(config.guidelinesGlob) !== JSON.stringify(REQUIRED_GUIDELINES))
    failures.push("guidelinesGlob must enumerate the seven design-system documents in reading order");
  for (const guideline of REQUIRED_GUIDELINES)
    if (!hasFile(guideline)) failures.push(`missing guideline: ${guideline}`);

  const entry = read(ENTRY_PATH);
  const componentNames = Object.keys(config.componentSrcMap ?? {}).sort();
  const dtsNames = Object.keys(config.dtsPropsFor ?? {}).sort();
  if (JSON.stringify(componentNames) !== JSON.stringify(dtsNames))
    failures.push("componentSrcMap and dtsPropsFor must expose the same public components");
  const generatedProps = deriveDesignSyncProps({ config });
  if (JSON.stringify(config.dtsPropsFor) !== JSON.stringify(generatedProps))
    failures.push("dtsPropsFor must be generated from source public Props types");

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
    const propsName = `${name}Props`;
    const entryExportsProps =
      generatedProps[name] === "" ||
      (isUiPrimitive && /export \* from ["']@\/components\/ui-primitives["']/.test(entry)) ||
      new RegExp(`export\\s*\\{[^}]*\\b${propsName}\\b[^}]*\\}`, "s").test(entry);
    if (!entryExportsProps) failures.push(`${propsName} is not exported by ${ENTRY_PATH}`);
    if (!previewIsValid(name, config))
      failures.push(`${name} preview is missing, malformed, or imports a different package`);
  }
  failures.push(...previewTypeFailures(componentNames, config));
  for (const supportExport of [
    "AnswerState",
    "LiveAnnouncer",
    "OverlayPortal",
    "RouteAnnouncer",
    "ToastProvider",
    "announce",
    "answerClipboardText",
    "answerStateFromRetrieval",
    "useToast",
  ]) {
    if (!new RegExp(`export\\s*\\{[^}]*\\b${supportExport}\\b[^}]*\\}`, "s").test(entry))
      failures.push(`${supportExport} support API is missing from ${ENTRY_PATH}`);
  }
  if (/sheet-focus/.test(entry)) failures.push("sheet-focus helpers must remain unpublished");

  if (failures.length) throw new Error(failures.join("\n"));
  process.stdout.write(
    `design-sync contract checked: ${componentNames.length} components and ${REQUIRED_GUIDELINES.length} guidelines\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
