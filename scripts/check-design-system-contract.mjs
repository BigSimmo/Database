import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "@typescript/typescript6";

import {
  RAW_COLOR_EXEMPTIONS,
  analyzeClassContractsInSource,
  analyzeCssContractsInSource,
  findDebtPathRegressions,
  findInteractiveTapLiteralsInSource,
  findTextSoftConsumersInSource,
  LEGACY_TAP_CLASS,
  hasLegacyTapClass,
  jsxClassText,
  rawColorContractSource,
} from "./design-system-contract-utils.mjs";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");
const BASELINE_PATH = path.join(ROOT, "scripts", "design-system-contract-baseline.json");
const PRINT_METRICS = process.argv.includes("--print-metrics");
const PRINT_BASELINE = process.argv.includes("--print-debt-baseline");
const SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/gi;
/** Whole-file backstop for literal shadow utilities the AST class-root pass can miss. */
const LITERAL_SHADOW_TEXT = /(?:^|[\s"'`])shadow-\[(?!var\()[^\]]+\]/g;
const ARBITRARY_TRACKING_TEXT = /(?:^|[\s"'`])tracking-\[(?!var\()[^\]]+\]/g;
const CUSTOM_CONTROL_CLASS_PROP =
  /(?:closeButtonClassName|sheetCloseButtonClassName|buttonClassName|triggerClassName)\s*=\s*(?:"([^"]*)"|`([^`]*)`)/g;

const toPosix = (value) => value.split(path.sep).join("/");

function isPrototype(relativePath) {
  return (
    relativePath.includes("/mockups/") ||
    relativePath.includes("-mockup") ||
    relativePath.includes("/favourites-page-mockups/")
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
      const classSource = classAttribute && ts.isJsxAttribute(classAttribute) ? classAttribute.getText(source) : "";
      // Recipes from controls.ts all include therapyBtn; accept either the base
      // export or a named control recipe in the className expression text.
      const hasTherapyInteraction =
        /\btherapyBtn\b/.test(classText) ||
        /\b(?:therapyBtn|accentControl|commandControl|outlineControl|softControl|iconControl|linkButton)\b/.test(
          classSource,
        );
      if (!hasTherapyInteraction) {
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
  edgeOwnershipConflicts: 0,
  onePixelShadowSpreads: 0,
  hardcodedCssMotionDurations: 0,
  rawCssZIndices: 0,
  legacyPaletteUtilities: 0,
  darkColorOverrides: 0,
  legacyShadowAliases: 0,
  arbitraryTracking: 0,
  layoutTransitionExceptions: 0,
  textSoftConsumers: 0,
};
const debtByPath = Object.fromEntries(Object.keys(metrics).map((metric) => [metric, {}]));
const recordDebt = (metric, relativePath, count) => {
  metrics[metric] += count;
  if (count > 0) debtByPath[metric][relativePath] = (debtByPath[metric][relativePath] ?? 0) + count;
};

const densityOverrideFindings = [];
const hardcodedMotionClassFindings = [];
const layoutTransitionFindings = [];
const unapprovedZIndexFindings = [];
const textSoftConsumerFindings = [];

for (const file of files) {
  const source = textAt(file.relativePath);
  const fileTextSoftConsumers = findTextSoftConsumersInSource(file.relativePath, source);
  recordDebt("textSoftConsumers", file.relativePath, fileTextSoftConsumers.length);
  textSoftConsumerFindings.push(...fileTextSoftConsumers);
  const rawColorSource = withoutComments(
    rawColorContractSource(file.relativePath, source, (message) => assert(false, message)),
  );
  recordDebt("rawColorLiterals", file.relativePath, countMatches(rawColorSource, RAW_COLOR));
  const classAnalysis = analyzeClassContractsInSource(file.relativePath, source);
  recordDebt("literalShadowClasses", file.relativePath, classAnalysis.literalShadowClasses.length);
  recordDebt("legacyTapClasses", file.relativePath, classAnalysis.legacyTapClasses.length);
  // Fail closed when a whole-file text scan finds debt the AST class-root pass
  // cannot see (unresolved identifiers, odd expression shapes). Baselines are 0,
  // so any miss would otherwise silently weaken the ratchet.
  const classTextSource = withoutComments(source);
  const textLegacyTap = countMatches(classTextSource, LEGACY_TAP_CLASS);
  const textLiteralShadow = countMatches(classTextSource, LITERAL_SHADOW_TEXT);
  const textArbitraryTracking = countMatches(classTextSource, ARBITRARY_TRACKING_TEXT);
  assert(
    classAnalysis.legacyTapClasses.length >= textLegacyTap,
    `${file.relativePath} has ${textLegacyTap} legacy tap class text match(es) but the AST class-root pass only saw ${classAnalysis.legacyTapClasses.length}`,
  );
  assert(
    classAnalysis.literalShadowClasses.length >= textLiteralShadow,
    `${file.relativePath} has ${textLiteralShadow} literal shadow class text match(es) but the AST class-root pass only saw ${classAnalysis.literalShadowClasses.length}`,
  );
  assert(
    classAnalysis.arbitraryTracking.length >= textArbitraryTracking,
    `${file.relativePath} has ${textArbitraryTracking} arbitrary tracking text match(es) but the AST class-root pass only saw ${classAnalysis.arbitraryTracking.length}`,
  );
  const fileEdgeFindings = classAnalysis.edgeOwnershipConflicts;
  recordDebt("edgeOwnershipConflicts", file.relativePath, fileEdgeFindings.length);
  recordDebt("legacyPaletteUtilities", file.relativePath, classAnalysis.legacyPaletteUtilities.length);
  recordDebt("darkColorOverrides", file.relativePath, classAnalysis.darkColorOverrides.length);
  recordDebt("legacyShadowAliases", file.relativePath, classAnalysis.legacyShadowAliases.length);
  recordDebt("arbitraryTracking", file.relativePath, classAnalysis.arbitraryTracking.length);
  densityOverrideFindings.push(...classAnalysis.densityOverrides);
  hardcodedMotionClassFindings.push(...classAnalysis.hardcodedMotionClasses);
  layoutTransitionFindings.push(...classAnalysis.layoutTransitions);
  unapprovedZIndexFindings.push(...classAnalysis.unapprovedZIndices);
  if (file.relativePath.endsWith(".css")) {
    const cssAnalysis = analyzeCssContractsInSource(file.relativePath, source);
    recordDebt("onePixelShadowSpreads", file.relativePath, cssAnalysis.onePixelShadowSpreads.length);
    recordDebt("hardcodedCssMotionDurations", file.relativePath, cssAnalysis.hardcodedMotionDurations.length);
    recordDebt("rawCssZIndices", file.relativePath, cssAnalysis.rawZIndices.length);
    recordDebt("legacyShadowAliases", file.relativePath, cssAnalysis.legacyShadowAliases.length);
    layoutTransitionFindings.push(...cssAnalysis.layoutTransitions);
  }
  for (const match of source.matchAll(CUSTOM_CONTROL_CLASS_PROP)) {
    assert(
      !hasLegacyTapClass(match[1] ?? match[2] ?? ""),
      `${file.relativePath} contains a legacy 44px class in a control class prop`,
    );
  }
}

assert(
  densityOverrideFindings.length === 0,
  `Chip/metadata density recipes have competing text or height utilities: ${densityOverrideFindings.join(", ")}`,
);
assert(
  hardcodedMotionClassFindings.length === 0,
  `hardcoded motion utilities or transition-all found: ${hardcodedMotionClassFindings.join(", ")}`,
);
assert(
  unapprovedZIndexFindings.length === 0,
  `Tailwind z-index utilities bypass the named ladder: ${unapprovedZIndexFindings.join(", ")}`,
);
assert(
  textSoftConsumerFindings.length === 0,
  `production code consumes the decoration-only --text-soft compatibility alias: ${textSoftConsumerFindings.join(", ")}`,
);

for (const [relativePath, findings] of Map.groupBy(layoutTransitionFindings, (finding) => finding.relativePath)) {
  recordDebt("layoutTransitionExceptions", relativePath, findings.length);
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
      // The completeness meter's fill is a data-driven percentage, which no utility
      // class can express. `--tc-meter-width` only existed to hand that value to
      // therapy-compass.css; as that stylesheet retires, the width is set directly.
      if (relativePath.endsWith("/ui.tsx")) return !/--tc-meter-width|width: `\$\{v\}%`/.test(line);
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

// Therapy's parallel stylesheet is retired. Printable paper tokens, print
// isolation, and interaction recipes live in globals.css + controls.ts.
assert(
  !fs.existsSync(path.join(ROOT, "src/components/therapy-compass/therapy-compass.css")),
  "therapy-compass.css must stay deleted — residuals live in globals.css",
);
const globalsForTherapy = textAt("src/app/globals.css");
assert(
  globalsForTherapy.includes("--tc-paper-muted: #5b6472"),
  "the fixed paper palette must keep its accessible muted ink",
);
assert(
  globalsForTherapy.includes('[data-therapy-paper] [contenteditable="true"]:focus-visible'),
  "patient-sheet editing needs a visible focus state",
);
assert(globalsForTherapy.includes("body:has([data-therapy-root])"), "Therapy print isolation must stay in globals.css");
assert(globalsForTherapy.includes("[data-therapy-no-print]"), "Therapy no-print hooks must stay in globals.css");
const controlsSource = textAt("src/components/therapy-compass/controls.ts");
assert(controlsSource.includes("hover:enabled:"), "Therapy buttons need a hover state");
assert(controlsSource.includes("disabled:"), "Therapy buttons need a disabled state");
assert(controlsSource.includes("export const therapyBtn"), "Therapy shared button recipe is missing");

const paperBlockStart = globalsForTherapy.indexOf("[data-therapy-paper] {");
const paperBlockEnd = globalsForTherapy.indexOf("[data-therapy-paper] [contenteditable");
const hasPaperBoundaries = paperBlockStart >= 0 && paperBlockEnd > paperBlockStart;
assert(hasPaperBoundaries, "patient-sheet paper rule boundaries are missing or misordered");
const paperRules = hasPaperBoundaries ? globalsForTherapy.slice(paperBlockStart, paperBlockEnd) : "";
assert(
  !/var\(--(?:background|surface|border|text|clinical|command|focus)/.test(paperRules),
  "patient-sheet paper rules leaked theme-reactive application tokens",
);

const semanticSources = [
  "src/components/therapy-compass/nav.tsx",
  // Therapy's navigation is the shared `ModeNav` now, so the current-page
  // semantics live there rather than in the mode's own file. Following the
  // component keeps this assertion true of the rendered markup instead of
  // passing on a file that no longer draws the navigation.
  "src/components/mode-nav/mode-nav.tsx",
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

if (!PRINT_METRICS && !PRINT_BASELINE) {
  assert(fs.existsSync(BASELINE_PATH), "design-system contract baseline is missing");
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const metricsShapeOk =
      baseline &&
      typeof baseline === "object" &&
      baseline.metrics !== null &&
      typeof baseline.metrics === "object" &&
      !Array.isArray(baseline.metrics) &&
      baseline.debtByPath !== null &&
      typeof baseline.debtByPath === "object" &&
      !Array.isArray(baseline.debtByPath);
    assert(metricsShapeOk, "design-system contract baseline schema is out of date: expected { metrics, debtByPath }");
    if (metricsShapeOk) {
      for (const [metric, value] of Object.entries(metrics)) {
        const baselineValue = baseline.metrics[metric];
        assert(typeof baselineValue === "number", `design-system contract baseline is missing metrics.${metric}`);
        assert(value <= baselineValue, `${metric} increased from ${baselineValue} to ${value}`);
        for (const regression of findDebtPathRegressions(metric, debtByPath[metric], baseline.debtByPath[metric])) {
          assert(false, regression);
        }
      }
    }
  }
}

if (PRINT_BASELINE) {
  console.log(JSON.stringify({ metrics, debtByPath }, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
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
  `Design-system contract passed (${files.length} production files; raw colors ${metrics.rawColorLiterals}; literal shadows ${metrics.literalShadowClasses}; legacy tap classes ${metrics.legacyTapClasses}; edge conflicts ${metrics.edgeOwnershipConflicts}; 1px shadow spreads ${metrics.onePixelShadowSpreads}).`,
);
console.log(
  `Motion/z/palette ratchets: hardcoded CSS durations ${metrics.hardcodedCssMotionDurations}; layout transitions ${metrics.layoutTransitionExceptions}; raw CSS z-index ${metrics.rawCssZIndices}; legacy palette utilities ${metrics.legacyPaletteUtilities}; dark color overrides ${metrics.darkColorOverrides}; legacy shadow aliases ${metrics.legacyShadowAliases}; arbitrary tracking ${metrics.arbitraryTracking}.`,
);
console.log(`Text-role ratchet: --text-soft consumers ${metrics.textSoftConsumers}.`);
console.log(`Raw-color exemptions: ${RAW_COLOR_EXEMPTIONS.map(({ category }) => category).join(", ")}.`);
