import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

import {
  LEGACY_TAP_CLASS,
  RAW_COLOR_EXEMPTIONS,
  findInteractiveTapLiteralsInSource,
  hasLegacyTapClass,
  jsxClassText,
  rawColorContractSource,
} from "./design-system-contract-utils.mjs";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");
const BASELINE_PATH = path.join(ROOT, "scripts", "design-system-contract-baseline.json");
const PRINT_METRICS = process.argv.includes("--print-metrics");
const SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/gi;
const LITERAL_SHADOW_CLASS = /shadow-\[(?!var\()[^\]]+\]/g;
const CUSTOM_CONTROL_CLASS_PROP =
  /(?:closeButtonClassName|sheetCloseButtonClassName|buttonClassName|triggerClassName)\s*=\s*(?:"([^"]*)"|`([^`]*)`)/g;

const toPosix = (value) => value.split(path.sep).join("/");

function isPrototype(relativePath) {
  return (
    relativePath.includes("/mockups/") ||
    relativePath.includes("-mockup") ||
    relativePath.includes("/favourites-page-mockups/") ||
    relativePath.includes("/calculator-mockups/")
  );
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    const relativePath = toPosix(path.relative(ROOT, absolutePath));
    return isPrototype(relativePath) ? [] : [{ absolutePath, relativePath }];
  });
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findInteractiveTapLiterals(file) {
  const sourceText = fs.readFileSync(file.absolutePath, "utf8");
  return findInteractiveTapLiteralsInSource(file.relativePath, sourceText);
}

function findTherapyButtonsWithoutBaseClass(file) {
  if (!file.relativePath.startsWith("src/components/therapy-compass/") || !file.relativePath.endsWith(".tsx"))
    return [];
  const sourceText = fs.readFileSync(file.absolutePath, "utf8");
  const source = ts.createSourceFile(file.relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(source) === "button"
    ) {
      const classAttribute = node.attributes.properties.find(
        (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className",
      );
      const classText = classAttribute && ts.isJsxAttribute(classAttribute) ? jsxClassText(classAttribute) : "";
      if (!classText.includes("tc-btn")) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push(`${file.relativePath}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

const files = walk(SRC_ROOT);
const contents = new Map(files.map((file) => [file.relativePath, fs.readFileSync(file.absolutePath, "utf8")]));
const textAt = (relativePath) => contents.get(relativePath) ?? "";
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const metrics = {
  rawColorLiterals: 0,
  literalShadowClasses: 0,
  legacyTapClasses: 0,
};

for (const file of files) {
  const source = textAt(file.relativePath);
  const contractSource = withoutComments(source);
  const rawColorSource = withoutComments(
    rawColorContractSource(file.relativePath, source, (message) => assert(false, message)),
  );
  metrics.rawColorLiterals += countMatches(rawColorSource, RAW_COLOR);
  metrics.literalShadowClasses += countMatches(contractSource, LITERAL_SHADOW_CLASS);
  metrics.legacyTapClasses += countMatches(contractSource, LEGACY_TAP_CLASS);
  for (const match of source.matchAll(CUSTOM_CONTROL_CLASS_PROP)) {
    assert(
      !hasLegacyTapClass(match[1] ?? match[2] ?? ""),
      `${file.relativePath} contains a legacy 44px class in a control class prop`,
    );
  }
}

const interactiveTapFindings = files.flatMap(findInteractiveTapLiterals);
assert(
  interactiveTapFindings.length === 0,
  `interactive elements still use literal *-11 tap classes: ${interactiveTapFindings.join(", ")}`,
);

const therapyFiles = files.filter(({ relativePath }) => relativePath.startsWith("src/components/therapy-compass/"));
const therapyButtonsWithoutBaseClass = therapyFiles.flatMap(findTherapyButtonsWithoutBaseClass);
const therapySource = therapyFiles.map(({ relativePath }) => textAt(relativePath)).join("\n");
const therapyInlineStyleFindings = therapyFiles.flatMap(({ relativePath }) => {
  const source = textAt(relativePath);
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /style=\{/.test(line))
    .filter(({ line }) => {
      if (relativePath.endsWith("/icons.tsx")) return !/style=\{style\}/.test(line);
      if (relativePath.endsWith("/ui.tsx")) return !/--tc-meter-width/.test(line);
      if (relativePath.endsWith("/screens/compare-screen.tsx")) return !/--tc-compare-columns/.test(line);
      return true;
    })
    .map(({ index }) => `${relativePath}:${index}`);
});

assert(!therapySource.includes("style={s("), "Therapy Compass still invokes the runtime style parser");
assert(!therapySource.includes("style-utils"), "Therapy Compass still imports the runtime style parser");
assert(
  therapyButtonsWithoutBaseClass.length === 0,
  `Therapy buttons bypass the shared interaction states: ${therapyButtonsWithoutBaseClass.join(", ")}`,
);
assert(
  !fs.existsSync(path.join(ROOT, "src/components/therapy-compass/style-utils.ts")),
  "style-utils.ts must stay retired",
);
assert(
  !fs.existsSync(path.join(ROOT, "src/components/therapy-compass/styles.tsx")),
  "the runtime Therapy style island must stay retired",
);
assert(
  therapyInlineStyleFindings.length === 0,
  `unscoped Therapy inline styles found: ${therapyInlineStyleFindings.join(", ")}`,
);
assert(!/outline\s*:\s*none/i.test(therapySource), "Therapy Compass suppresses a focus outline");
assert(!therapySource.toLowerCase().includes("#8a94a3"), "the low-contrast patient-sheet gray returned");

const therapyCss = textAt("src/components/therapy-compass/therapy-compass.css");
assert(!/(?:^|[^0-9])44px/.test(therapyCss), "Therapy Compass CSS contains a literal 44px tap target");
assert(therapyCss.includes("--tc-paper-muted: #5b6472"), "the fixed paper palette must keep its accessible muted ink");
assert(
  therapyCss.includes('.tc-paper [contenteditable="true"]:focus-visible'),
  "patient-sheet editing needs a visible focus state",
);
assert(therapyCss.includes(".tc-btn:hover:not(:disabled)"), "Therapy buttons need a hover state");
assert(therapyCss.includes(".tc-btn:disabled"), "Therapy buttons need a disabled state");

const paperStart = therapyCss.indexOf(".tc-root .tc-screens-sheets-screen-023");
const paperEnd = therapyCss.indexOf(".tc-root .tc-screens-sheets-screen-050");
const hasPaperBoundaries = paperStart >= 0 && paperEnd > paperStart;
assert(hasPaperBoundaries, "patient-sheet paper rule boundaries are missing or misordered");
const paperRules = hasPaperBoundaries ? therapyCss.slice(paperStart, paperEnd) : therapyCss;
assert(
  !/var\(--(?:background|surface|border|text|clinical|command|focus)/.test(paperRules),
  "patient-sheet paper rules leaked theme-reactive application tokens",
);

const semanticSources = [
  "src/components/therapy-compass/nav.tsx",
  "src/components/therapy-compass/therapy-card.tsx",
  "src/components/therapy-compass/screens/brief-screen.tsx",
  "src/components/therapy-compass/screens/compare-screen.tsx",
  "src/components/therapy-compass/screens/search-screen.tsx",
  "src/components/therapy-compass/screens/sheets-screen.tsx",
]
  .map(textAt)
  .join("\n");
assert(semanticSources.includes("aria-current"), "Therapy navigation needs aria-current");
assert(semanticSources.includes("aria-pressed"), "Therapy toggles need aria-pressed");
assert(!semanticSources.includes('role="tab"'), "Therapy toggle groups must not claim incomplete tab semantics");
assert(
  /disabled=\{items\.length === 0\}/.test(textAt("src/components/therapy-compass/screens/compare-screen.tsx")),
  "empty compare Clear must be disabled",
);

const globals = textAt("src/app/globals.css");
assert(!/^\s*--space-\d+\s*:/m.test(globals), "unused --space-* tokens returned");
const primitives = textAt("src/components/ui-primitives.tsx");
assert(
  primitives.includes('export const chatComposerInput = "chat-composer-input"'),
  "composer input chrome must have one CSS owner",
);
assert(primitives.includes("aria-[invalid=true]"), "shared fields need an invalid state");
assert(primitives.includes("read-only:"), "shared fields need a read-only state");
assert(primitives.includes("export function AsyncButton"), "shared async button semantics are missing");

for (const target of [
  "src/components/DocumentViewer.tsx",
  "src/components/clinical-dashboard/favourites-hub.tsx",
  "src/components/clinical-dashboard/master-search-header.tsx",
  "src/components/clinical-dashboard/mode-action-popup.tsx",
  "src/components/clinical-dashboard/settings-dialog.tsx",
]) {
  assert(!/\bring-white\b|\bbg-white\b/.test(textAt(target)), `${target} bypasses the shared glass/toggle recipes`);
}

if (!PRINT_METRICS) {
  assert(fs.existsSync(BASELINE_PATH), "design-system contract baseline is missing");
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    for (const [metric, value] of Object.entries(metrics)) {
      assert(value <= baseline[metric], `${metric} increased from ${baseline[metric]} to ${value}`);
    }
  }
}

if (PRINT_METRICS) {
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
}

if (failures.length > 0) {
  console.error("Design-system contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Design-system contract passed (${files.length} production files; raw colors ${metrics.rawColorLiterals}; literal shadows ${metrics.literalShadowClasses}; legacy tap classes ${metrics.legacyTapClasses}).`,
);
console.log(`Raw-color exemptions: ${RAW_COLOR_EXEMPTIONS.map(({ category }) => category).join(", ")}.`);
