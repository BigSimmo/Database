import ts from "@typescript/typescript6";
import postcss from "postcss";

const LEGACY_TAP_TOKEN_SOURCE = String.raw`(?:[^\s:"'\x60]+:)*(?:h|w|min-h|min-w|size)-11`;

export const LEGACY_TAP_CLASS = new RegExp(`(?:^|[\\s\"'\\x60])${LEGACY_TAP_TOKEN_SOURCE}(?=[\\s\"'\\x60]|$)`, "g");
const LEGACY_TAP_CLASS_TEST = new RegExp(`(?:^|[\\s\"'\\x60])${LEGACY_TAP_TOKEN_SOURCE}(?=[\\s\"'\\x60]|$)`);

export const RAW_COLOR_EXEMPTIONS = [
  // Both files are the theme-token layer itself — the one place raw colour values
  // are *defined* rather than consumed. `ckb-v2-tokens.css` is the opt-in `.ckb-v2`
  // layer, split out of globals.css only for readability; it declares no rules
  // beyond custom properties.
  { category: "global theme tokens", pattern: /^src\/app\/(?:globals|ckb-v2-tokens)\.css$/, scope: "whole-file" },
  {
    category: "brand artwork",
    pattern:
      /^src\/(?:lib\/brand-(?:mark\.ts|image\.tsx)|components\/clinical-dashboard\/(?:brand|provider-brand-icons)\.tsx)$/,
    scope: "whole-file",
  },
  {
    category: "diagnostic visualizations",
    pattern: /^src\/components\/(?:web-vitals-reporter|clinical-dashboard\/visual-evidence)\.tsx$/,
    scope: "whole-file",
  },
  { category: "OpenGraph artwork", pattern: /^src\/app\/opengraph-image\.tsx$/, scope: "whole-file" },
  {
    category: "error fallbacks",
    pattern: /^src\/(?:app\/global-error|components\/route-error-boundary)\.tsx$/,
    scope: "whole-file",
  },
  {
    // Pre-paint / meta theme-color values: consumed as raw colours by the inline
    // pre-hydration theme script and the browser theme-color meta tag, before any
    // CSS (and therefore any token) is available, so they cannot be tokenised.
    // Scoped to the APP_THEME_COLORS declaration rather than the whole file: only
    // those two literals are un-tokenisable, so any other raw colour added to
    // theme.ts later must stay visible to the ratcheting contract.
    category: "pre-paint theme color",
    pattern: /^src\/lib\/theme\.ts$/,
    scope: "app-theme-colors",
  },
  {
    category: "printable factsheet paper",
    pattern: /^src\/components\/factsheets\/factsheet-detail-page\.tsx$/,
    scope: "factsheet-print-sheet",
  },
];

export function hasLegacyTapClass(classText) {
  return LEGACY_TAP_CLASS_TEST.test(classText);
}

export function jsxClassSegments(attribute) {
  const initializer = attribute.initializer;
  if (!initializer) return [];
  if (ts.isStringLiteral(initializer)) return [initializer.text];
  if (!ts.isJsxExpression(initializer) || !initializer.expression) return [];

  const segments = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      segments.push(node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      segments.push(node.head.text);
      for (const span of node.templateSpans) {
        visit(span.expression);
        segments.push(span.literal.text);
      }
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(initializer.expression);
  return segments;
}

export function jsxClassText(attribute) {
  const segments = jsxClassSegments(attribute);
  if (segments.length > 0) return segments.join(" ");
  const initializer = attribute.initializer;
  return ts.isJsxExpression(initializer) && initializer.expression ? initializer.expression.getText() : "";
}

export function findInteractiveTapLiteralsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx")) return [];
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const interactiveTags = new Set(["a", "button", "input", "select", "summary", "textarea"]);

  function inspectOpeningElement(node) {
    const tag = node.tagName.getText(source);
    if (!interactiveTags.has(tag)) return;
    const classAttribute = node.attributes.properties.find(
      (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className",
    );
    if (!classAttribute || !ts.isJsxAttribute(classAttribute)) return;
    if (!jsxClassSegments(classAttribute).some(hasLegacyTapClass)) return;
    const line = source.getLineAndCharacterOfPosition(classAttribute.getStart(source)).line + 1;
    findings.push(`${relativePath}:${line}`);
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) inspectOpeningElement(node);
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

const BORDER_WIDTH_UTILITY = /^border(?:-[xytrblse])?(?:-(?:0|2|4|8|\[(?!color:)[^\]]+\]))?$/;
const RING_WIDTH_UTILITY = /^ring(?:-(?:0|1|2|4|8|\[(?!color:)[^\]]+\]))?$/;
const DENSITY_HEIGHT_UTILITY = /^(?:h|min-h|max-h|size)-/;
const DENSITY_TEXT_UTILITY = /^text-(?:2xs|xs|sm-minus|sm|base|lg|xl|[2-9]xl|\[[^\]]*(?:px|rem|em|clamp\()[^\]]*\])$/;
const HARDCODED_MOTION_UTILITY = /^(?:duration|delay)-(?:\d+|\[(?!var\(--duration-)[^\]]+\])$/;
const LITERAL_SHADOW_UTILITY = /^shadow-\[(?!var\()[^\]]+\]$/;
const LEGACY_SHADOW_ALIAS = /var\(--shadow-(?:tight|card|soft|hover|elevated|lux|lift)\)/g;
const LEGACY_PALETTE_UTILITY =
  /^(?:bg|text|border|ring|outline|fill|stroke|placeholder|from|via|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone)-\d{2,3})(?:\/\d{1,3})?$/;
const COLOR_VALUE =
  /^(?:inherit|current|transparent|black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/\d{1,3})?$/;
const ALLOWED_Z_INDEX_RUNGS = new Set([0, 5, 10, 20, 30, 40, 60, 80, 81, 82, 83, 84, 85, 95, 100, 110]);
const ALLOWED_Z_INDEX_TOKENS = new Set([
  "--z-raised",
  "--z-chrome",
  "--z-overlay",
  "--z-popover",
  "--z-modal",
  "--z-toast",
]);
const SAFE_TRANSITION_PROPERTIES = new Set([
  "none",
  "color",
  "background-color",
  "border-color",
  "text-decoration-color",
  "fill",
  "stroke",
  "opacity",
  "box-shadow",
  "transform",
  "filter",
  "backdrop-filter",
  "visibility",
  "scrollbar-color",
]);
const CLASS_COMPOSERS = new Set(["cn", "clsx", "cva"]);
const CLASS_UTILITY_PREFIX =
  /^(?:-?(?:m|p)[trblxy]?|h|w|min-h|max-h|min-w|max-w|size|text|font|leading|tracking|bg|border|ring|outline|shadow|rounded|opacity|z|top|right|bottom|left|inset|gap|space|grid|flex|block|inline|hidden|relative|absolute|fixed|sticky|overflow|overscroll|object|cursor|select|pointer-events|transition|duration|delay|animate|transform|translate|scale|rotate|skew|origin|items|justify|content|self|place|order|grow|shrink|basis|whitespace|break|truncate|line-clamp|decoration|underline|fill|stroke|from|via|to|backdrop|blur|filter|appearance|sr-only|not-sr-only)(?:-|$)/;

function splitUtilityTokens(text) {
  return text.split(/\s+/).filter(Boolean);
}

function splitTailwindVariants(token) {
  const parts = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];
    if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (character === "(") roundDepth += 1;
    else if (character === ")") roundDepth = Math.max(0, roundDepth - 1);
    else if (character === ":" && squareDepth === 0 && roundDepth === 0) {
      parts.push(token.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(token.slice(start));
  return parts;
}

function utilityBase(token) {
  return splitTailwindVariants(token).at(-1)?.replace(/^!/, "") ?? "";
}

function utilityVariants(token) {
  return splitTailwindVariants(token).slice(0, -1);
}

function jsxClassAttribute(node, source) {
  return jsxClassAttributes(node, source)[0];
}

function jsxClassAttributes(node, source) {
  return node.attributes.properties.filter(
    (attribute) => ts.isJsxAttribute(attribute) && /(?:^|[A-Z])className$/i.test(attribute.name.getText(source)),
  );
}

function combinePossibilities(left, right) {
  return left.flatMap((leftEntry) =>
    right.map((rightEntry) => ({
      usesDensityRecipe: leftEntry.usesDensityRecipe || rightEntry.usesDensityRecipe,
      tokens: [...leftEntry.tokens, ...rightEntry.tokens],
    })),
  );
}

function tokenEntries(node, source) {
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  return splitUtilityTokens(node.text).map((token, index) => ({
    id: `${node.getStart(source)}:${index}:${token}`,
    line,
    token,
  }));
}

function classExpressionAnalyzer(relativePath, sourceText) {
  if (!/\.[cm]?[jt]sx?$/.test(relativePath)) return null;
  const kind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, kind);
  const variables = new Map();
  const densityAliases = new Set(["metadataPill", "metadataPillDensity"]);

  function collectBindings(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const specifier of node.importClause.namedBindings.elements) {
        const imported = specifier.propertyName?.text ?? specifier.name.text;
        if (imported === "metadataPill" || imported === "metadataPillDensity") densityAliases.add(specifier.name.text);
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      variables.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectBindings);
  }
  collectBindings(source);

  const empty = () => [{ usesDensityRecipe: false, tokens: [] }];

  function possibilities(node, resolving = new Set()) {
    if (!node) return empty();
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return possibilities(node.expression, resolving);
    }
    if (ts.isConditionalExpression(node)) {
      return [...possibilities(node.whenTrue, resolving), ...possibilities(node.whenFalse, resolving)];
    }
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        return [...empty(), ...possibilities(node.right, resolving)];
      }
      if (
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return [...possibilities(node.left, resolving), ...possibilities(node.right, resolving)];
      }
      return combinePossibilities(possibilities(node.left, resolving), possibilities(node.right, resolving));
    }
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression) ? node.expression.text : "";
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.name.text === "filter" || node.expression.name.text === "join")
      ) {
        return possibilities(node.expression.expression, resolving);
      }
      if (!CLASS_COMPOSERS.has(callee)) return empty();
      return node.arguments.reduce(
        (entries, argument) => combinePossibilities(entries, possibilities(argument, resolving)),
        empty(),
      );
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.reduce(
        (entries, element) => combinePossibilities(entries, possibilities(element, resolving)),
        empty(),
      );
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.reduce((entries, property) => {
        if (ts.isSpreadAssignment(property))
          return combinePossibilities(entries, possibilities(property.expression, resolving));
        if (ts.isShorthandPropertyAssignment(property)) {
          return combinePossibilities(entries, possibilities(property.name, resolving));
        }
        if (!ts.isPropertyAssignment(property)) return entries;
        const name = property.name;
        const keyEntries =
          ts.isStringLiteralLike(name) || ts.isIdentifier(name)
            ? [{ usesDensityRecipe: false, tokens: tokenEntries(name, source) }]
            : ts.isComputedPropertyName(name)
              ? possibilities(name.expression, resolving)
              : empty();
        return combinePossibilities(entries, [...empty(), ...keyEntries]);
      }, empty());
    }
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return [{ usesDensityRecipe: false, tokens: tokenEntries(node, source) }];
    }
    if (ts.isTemplateExpression(node)) {
      let entries = [{ usesDensityRecipe: false, tokens: tokenEntries(node.head, source) }];
      for (const span of node.templateSpans) {
        entries = combinePossibilities(entries, possibilities(span.expression, resolving));
        entries = combinePossibilities(entries, [
          { usesDensityRecipe: false, tokens: tokenEntries(span.literal, source) },
        ]);
      }
      return entries;
    }
    if (ts.isIdentifier(node)) {
      if (densityAliases.has(node.text)) return [{ usesDensityRecipe: true, tokens: [] }];
      const initializer = variables.get(node.text);
      if (!initializer || resolving.has(node.text)) return empty();
      const next = new Set(resolving);
      next.add(node.text);
      return possibilities(initializer, next);
    }
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression) && densityAliases.has(node.expression.text)) {
        return [{ usesDensityRecipe: true, tokens: [] }];
      }
      if (ts.isIdentifier(node.expression)) {
        const initializer = variables.get(node.expression.text);
        if (initializer && ts.isObjectLiteralExpression(initializer)) {
          const property = initializer.properties.find(
            (candidate) =>
              ts.isPropertyAssignment(candidate) &&
              ((ts.isIdentifier(candidate.name) && candidate.name.text === node.name.text) ||
                (ts.isStringLiteralLike(candidate.name) && candidate.name.text === node.name.text)),
          );
          if (property && ts.isPropertyAssignment(property)) return possibilities(property.initializer, resolving);
        }
      }
      return empty();
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const initializer = variables.get(node.expression.text);
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) return empty();
      const requested = ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
      return initializer.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const propertyName =
          ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : null;
        if (requested !== null && propertyName !== requested) return [];
        return possibilities(property.initializer, resolving);
      });
    }
    return empty();
  }

  function looksLikeClassExpression(node) {
    const tokens = [];
    function collect(candidate) {
      if (ts.isStringLiteralLike(candidate) || ts.isTemplateLiteralToken(candidate)) {
        tokens.push(...splitUtilityTokens(candidate.text).map(utilityBase));
      }
      ts.forEachChild(candidate, collect);
    }
    collect(node);
    if (tokens.length === 0) return false;
    const utilityCount = tokens.filter((token) => CLASS_UTILITY_PREFIX.test(token)).length;
    return utilityCount >= 1 && utilityCount / tokens.length >= 0.5;
  }

  const classRoots = [];
  function collectClassRoots(node, insideClassAttribute = false) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const attribute of jsxClassAttributes(node, source)) {
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
        const expression = ts.isJsxExpression(attribute.initializer)
          ? attribute.initializer.expression
          : attribute.initializer;
        if (expression) classRoots.push({ expression, owner: node, tag: node.tagName.getText(source) });
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = ts.isIdentifier(node.expression) ? node.expression.text : "";
      if (CLASS_COMPOSERS.has(callee) && !insideClassAttribute)
        classRoots.push({ expression: node, owner: node, tag: callee });
    }
    if (ts.isVariableDeclaration(node) && node.initializer && looksLikeClassExpression(node.initializer)) {
      const statement = node.parent?.parent;
      const exported =
        statement &&
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      const recipeName =
        ts.isIdentifier(node.name) &&
        /(?:class|classes|recipe|control|surface|pill|chip|button)$/i.test(node.name.text);
      if (exported || recipeName) classRoots.push({ expression: node.initializer, owner: node, tag: "recipe" });
    }
    const nextInside =
      insideClassAttribute || (ts.isJsxAttribute(node) && /(?:^|[A-Z])className$/i.test(node.name.getText(source)));
    if (ts.isReturnStatement(node) && node.expression && looksLikeClassExpression(node.expression)) {
      let owner = node.parent;
      while (
        owner &&
        !ts.isFunctionDeclaration(owner) &&
        !ts.isFunctionExpression(owner) &&
        !ts.isArrowFunction(owner)
      ) {
        owner = owner.parent;
      }
      const functionName =
        owner && ts.isFunctionDeclaration(owner)
          ? owner.name?.text
          : owner?.parent && ts.isVariableDeclaration(owner.parent) && ts.isIdentifier(owner.parent.name)
            ? owner.parent.name.text
            : "";
      if (/(?:class|classes|recipe|style)$/i.test(functionName ?? "")) {
        classRoots.push({ expression: node.expression, owner: node, tag: "recipe" });
      }
    }
    ts.forEachChild(node, (child) => collectClassRoots(child, nextInside));
  }
  collectClassRoots(source);

  return { classRoots, possibilities, source };
}

function isColorUtility(base) {
  const match = base.match(/^(?:bg|text|border|ring|outline|fill|stroke|placeholder|from|via|to)-(.+)$/);
  if (!match) return false;
  const value = match[1];
  return COLOR_VALUE.test(value) || /^\[(?:color:)?(?:var\(|#|rgb|hsl|oklch)/.test(value);
}

function uniqueTokenEntries(possibilities) {
  const tokens = new Map();
  for (const possibility of possibilities) {
    for (const entry of possibility.tokens) tokens.set(entry.id, entry);
  }
  return [...tokens.values()];
}

export function analyzeClassContractsInSource(relativePath, sourceText) {
  const analyzer = classExpressionAnalyzer(relativePath, sourceText);
  const result = {
    darkColorOverrides: [],
    densityOverrides: [],
    edgeOwnershipConflicts: [],
    hardcodedMotionClasses: [],
    layoutTransitions: [],
    legacyShadowAliases: [],
    legacyTapClasses: [],
    legacyPaletteUtilities: [],
    literalShadowClasses: [],
    unapprovedZIndices: [],
  };
  if (!analyzer) return result;

  const allTokens = new Map();
  for (const root of analyzer.classRoots) {
    const possibilities = analyzer.possibilities(root.expression);
    const densityConflictsForRoot = new Set();
    for (const possibility of possibilities) {
      const bases = possibility.tokens.map(({ token }) => utilityBase(token));
      if (
        bases.some((token) => BORDER_WIDTH_UTILITY.test(token)) &&
        bases.some((token) => RING_WIDTH_UTILITY.test(token))
      ) {
        const line = analyzer.source.getLineAndCharacterOfPosition(root.owner.getStart(analyzer.source)).line + 1;
        result.edgeOwnershipConflicts.push(`${relativePath}:${line}`);
        break;
      }
      const densityConflicts = possibility.tokens.filter(({ token }) => {
        const base = utilityBase(token);
        return DENSITY_HEIGHT_UTILITY.test(base) || DENSITY_TEXT_UTILITY.test(base);
      });
      if ((root.tag === "Chip" || possibility.usesDensityRecipe) && densityConflicts.length > 0) {
        for (const { token } of densityConflicts) densityConflictsForRoot.add(utilityBase(token));
      }
    }
    if (densityConflictsForRoot.size > 0) {
      const line = analyzer.source.getLineAndCharacterOfPosition(root.owner.getStart(analyzer.source)).line + 1;
      result.densityOverrides.push(`${relativePath}:${line} (${[...densityConflictsForRoot].join(", ")})`);
    }
    for (const entry of uniqueTokenEntries(possibilities)) allTokens.set(entry.id, entry);
  }

  for (const { token, line } of allTokens.values()) {
    const base = utilityBase(token);
    const variants = utilityVariants(token);
    if (base === "transition-all" || HARDCODED_MOTION_UTILITY.test(base)) {
      result.hardcodedMotionClasses.push(`${relativePath}:${line} (${token})`);
    }
    if (LITERAL_SHADOW_UTILITY.test(base)) result.literalShadowClasses.push(`${relativePath}:${line} (${token})`);
    if (hasLegacyTapClass(token)) result.legacyTapClasses.push(`${relativePath}:${line} (${token})`);
    for (const match of token.matchAll(LEGACY_SHADOW_ALIAS)) {
      result.legacyShadowAliases.push(`${relativePath}:${line} (${match[0]})`);
    }
    const transition = base.match(/^transition-\[([^\]]+)\]$/);
    if (transition) {
      const properties = transition[1].split(/[,_]/).filter(Boolean);
      for (const property of properties) {
        if (!SAFE_TRANSITION_PROPERTIES.has(property)) result.layoutTransitions.push({ relativePath, line, property });
      }
    }
    if (/^-?z-(?:\[|\(|\$|$)/.test(base) || /^-?z-\d+$/.test(base)) {
      const numeric = base.match(/^(-?)z-(?:\[(-?\d+)\]|(-?\d+))$/);
      const tokenMatch = base.match(/^z-(?:\[var\((--z-[a-z-]+)\)\]|\((--z-[a-z-]+)\))$/);
      const numericAllowed = numeric && ALLOWED_Z_INDEX_RUNGS.has(Number(`${numeric[1]}${numeric[2] ?? numeric[3]}`));
      const tokenAllowed = tokenMatch && ALLOWED_Z_INDEX_TOKENS.has(tokenMatch[1] ?? tokenMatch[2]);
      if (!numericAllowed && !tokenAllowed) result.unapprovedZIndices.push(`${relativePath}:${line} (${token})`);
    }
    if (LEGACY_PALETTE_UTILITY.test(base)) result.legacyPaletteUtilities.push(`${relativePath}:${line} (${token})`);
    if (variants.includes("dark") && isColorUtility(base)) {
      result.darkColorOverrides.push(`${relativePath}:${line} (${token})`);
    }
  }

  result.edgeOwnershipConflicts = [...new Set(result.edgeOwnershipConflicts)];
  result.densityOverrides = [...new Set(result.densityOverrides)];
  return result;
}

export function findJsxEdgeOwnershipConflictsInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).edgeOwnershipConflicts;
}

export function findDensityRecipeOverridesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).densityOverrides;
}

export function findHardcodedMotionClassesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).hardcodedMotionClasses;
}

export function findLayoutTransitionClassesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).layoutTransitions;
}

export function findUnapprovedZIndexClassesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).unapprovedZIndices;
}

export function countLegacyPaletteUtilitiesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).legacyPaletteUtilities.length;
}

export function countDarkColorOverridesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).darkColorOverrides.length;
}

function splitCssShadowLayers(value) {
  const layers = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) {
      layers.push(value.slice(start, index));
      start = index + 1;
    }
  }
  layers.push(value.slice(start));
  return layers;
}

function topLevelCssTokens(value) {
  const tokens = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    if ((index === value.length || /\s/.test(character)) && depth === 0) {
      const token = value.slice(start, index).trim();
      if (token) tokens.push(token);
      start = index + 1;
    }
  }
  return tokens;
}

function layerHasOnePixelSpread(layer) {
  const lengths = topLevelCssTokens(layer).filter((token) =>
    /^-?(?:0|\d*\.?\d+(?:px|rem|em|vh|vw|vmin|vmax))$/.test(token),
  );
  return lengths.length >= 4 && lengths[3] === "1px";
}

function cssDeclarations(sourceText) {
  const declarations = [];
  postcss.parse(sourceText).walkDecls((declaration) => declarations.push(declaration));
  return declarations;
}

function transitionProperties(declaration) {
  if (declaration.prop === "transition-property") return declaration.value.split(",").map((value) => value.trim());
  if (declaration.prop !== "transition") return [];
  return splitCssShadowLayers(declaration.value)
    .map((layer) => topLevelCssTokens(layer)[0])
    .filter(Boolean);
}

export function analyzeCssContractsInSource(relativePath, sourceText) {
  const result = {
    hardcodedMotionDurations: [],
    layoutTransitions: [],
    legacyShadowAliases: [],
    onePixelShadowSpreads: [],
    rawZIndices: [],
  };
  for (const declaration of cssDeclarations(sourceText)) {
    const line = declaration.source?.start?.line ?? 1;
    const prop = declaration.prop.toLowerCase();
    for (const match of declaration.value.matchAll(LEGACY_SHADOW_ALIAS)) {
      result.legacyShadowAliases.push(`${relativePath}:${line} (${prop} ${match[0]})`);
    }
    if (prop === "box-shadow" || /^--(?:e[0-4]|shadow-[a-z0-9-]+)$/.test(prop)) {
      splitCssShadowLayers(declaration.value).forEach((layer, index) => {
        if (layerHasOnePixelSpread(layer)) {
          result.onePixelShadowSpreads.push(`${relativePath}:${line} (${prop} layer ${index + 1})`);
        }
      });
    }
    if (/^(?:transition|animation)(?:-duration|-delay)?$/.test(prop)) {
      for (const duration of declaration.value.matchAll(/(?<![-\w])\d*\.?\d+(?:ms|s)\b/g)) {
        result.hardcodedMotionDurations.push(`${relativePath}:${line} (${prop} ${duration[0]})`);
      }
    }
    for (const property of transitionProperties(declaration)) {
      if (!SAFE_TRANSITION_PROPERTIES.has(property)) result.layoutTransitions.push({ relativePath, line, property });
    }
    if (prop === "z-index" && /^-?\d+$/.test(declaration.value.trim())) {
      result.rawZIndices.push(`${relativePath}:${line} (${declaration.value.trim()})`);
    }
  }
  return result;
}

export function countOnePixelShadowSpreadsInSource(sourceText) {
  return analyzeCssContractsInSource("source.css", sourceText).onePixelShadowSpreads.length;
}

export function countHardcodedCssMotionDurations(sourceText) {
  return analyzeCssContractsInSource("source.css", sourceText).hardcodedMotionDurations.length;
}

export function findCssLayoutTransitionsInSource(relativePath, sourceText) {
  return analyzeCssContractsInSource(relativePath, sourceText).layoutTransitions;
}

export function countRawCssZIndicesInSource(sourceText) {
  return analyzeCssContractsInSource("source.css", sourceText).rawZIndices.length;
}

export function findDebtPathRegressions(metric, currentByPath, baselineByPath) {
  return Object.entries(currentByPath)
    .filter(([relativePath, count]) => count > (baselineByPath?.[relativePath] ?? 0))
    .map(
      ([relativePath, count]) =>
        `${metric} at ${relativePath} increased from ${baselineByPath?.[relativePath] ?? 0} to ${count}`,
    );
}

function maskRanges(source, ranges) {
  const characters = source.split("");
  for (const { start, end } of ranges) characters.fill(" ", start, end);
  return characters.join("");
}

function balancedBlockRange(source, marker) {
  // Find a valid occurrence of the marker, skipping false matches that are:
  // 1. Followed by an identifier-continuation character (to avoid suffixed declarations)
  // 2. Inside a line comment, block comment, or string literal
  let candidateStart = 0;
  while (true) {
    candidateStart = source.indexOf(marker, candidateStart);
    if (candidateStart < 0) return null;

    // Check if the character after the marker is an identifier-continuation character
    const charAfterMarker = source[candidateStart + marker.length];
    const isIdentifierContinuation = charAfterMarker && /[A-Za-z0-9_$]/.test(charAfterMarker);
    if (isIdentifierContinuation) {
      candidateStart += 1;
      continue;
    }

    // Check if this occurrence is inside a comment or string
    if (isInsideCommentOrString(source, candidateStart)) {
      candidateStart += 1;
      continue;
    }

    // Valid match found
    break;
  }

  const start = candidateStart;
  const openingBrace = source.indexOf("{", start);
  if (openingBrace < 0) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;
  let inComment = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    if (inComment) {
      if (character === "*" && source[index + 1] === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character !== "}") continue;
    depth -= 1;
    if (depth === 0) return { start, end: index + 1 };
  }
  return null;
}

function isInsideCommentOrString(source, position) {
  // Scan from the beginning to determine if position is inside a comment or string
  let inLineComment = false;
  let inBlockComment = false;
  let inString = null;
  let escaped = false;

  for (let index = 0; index < position; index += 1) {
    const character = source[index];

    if (inLineComment) {
      if (character === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (character === "*" && source[index + 1] === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === inString) {
        inString = null;
      }
      continue;
    }

    if (character === "/" && source[index + 1] === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (character === "/" && source[index + 1] === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      inString = character;
    }
  }

  return inLineComment || inBlockComment || inString !== null;
}

function namedFunctionRange(relativePath, source, functionName) {
  const parsed = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = parsed.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === functionName,
  );
  return declaration ? { start: declaration.getFullStart(), end: declaration.end } : null;
}

export function rawColorContractSource(relativePath, source, reportFailure = () => {}) {
  const exemption = RAW_COLOR_EXEMPTIONS.find(({ pattern }) => pattern.test(relativePath));
  if (!exemption) return source;
  if (exemption.scope === "whole-file") return "";

  if (exemption.scope === "app-theme-colors") {
    // Anchored on the declaration keyword, not a bare identifier, so a later
    // *reference* to APP_THEME_COLORS can never be mistaken for the boundary.
    const range = balancedBlockRange(source, "export const APP_THEME_COLORS");
    if (!range) {
      reportFailure("pre-paint theme-color boundary is missing");
      return source;
    }
    return maskRanges(source, [range]);
  }

  if (exemption.scope === "factsheet-print-sheet") {
    const range = namedFunctionRange(relativePath, source, "FactsheetPrintSheet");
    if (!range) {
      reportFailure("printable factsheet paper boundary is missing");
      return source;
    }
    return maskRanges(source, [range]);
  }

  reportFailure(`unknown raw-color exemption scope for ${relativePath}`);
  return source;
}
