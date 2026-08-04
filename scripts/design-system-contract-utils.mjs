import ts from "@typescript/typescript6";

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
const LEGACY_PALETTE_UTILITY =
  /^(?:bg|text|border|ring|outline|fill|stroke|placeholder|from|via|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone)-\d{2,3})(?:\/\d{1,3})?$/;
const COLOR_UTILITY =
  /^(?:bg|text|border|ring|outline|fill|stroke|placeholder|from|via|to)-(?:\[[^\]]+\]|[a-z]+(?:-[a-z]+)*(?:-\d{2,3})?)(?:\/\d{1,3})?$/;
const ALLOWED_Z_INDEX_RUNGS = new Set([0, 5, 10, 20, 30, 40, 60, 80, 81, 82, 83, 84, 85, 95, 100, 110]);
const LAYOUT_TRANSITION_PROPERTIES = new Set([
  "width",
  "height",
  "grid-template-columns",
  "grid-template-rows",
  "top",
  "left",
  "gap",
  "padding-bottom",
]);

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

function staticUtilityTokensInSource(relativePath, sourceText) {
  if (!/\.[cm]?[jt]sx?$/.test(relativePath)) return [];
  const kind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, kind);
  const tokens = [];

  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      for (const token of splitUtilityTokens(node.text)) tokens.push({ token, line });
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return tokens;
}

function jsxClassAttribute(node, source) {
  return node.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className",
  );
}

export function findJsxEdgeOwnershipConflictsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx")) return [];
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classAttribute = jsxClassAttribute(node, source);
      if (classAttribute && ts.isJsxAttribute(classAttribute)) {
        // Inspect each literal segment independently. Combining all branches of a
        // conditional class expression would report border/ring pairs that can
        // never be present on the element at the same time.
        const conflicts = jsxClassSegments(classAttribute).filter((segment) => {
          const bases = splitUtilityTokens(segment).map(utilityBase);
          return (
            bases.some((token) => BORDER_WIDTH_UTILITY.test(token)) &&
            bases.some((token) => RING_WIDTH_UTILITY.test(token))
          );
        });
        if (conflicts.length > 0) {
          const line = source.getLineAndCharacterOfPosition(classAttribute.getStart(source)).line + 1;
          findings.push(`${relativePath}:${line}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

export function findDensityRecipeOverridesInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx")) return [];
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  const combine = (left, right) =>
    left.flatMap((leftEntry) =>
      right.map((rightEntry) => ({
        usesDensityRecipe: leftEntry.usesDensityRecipe || rightEntry.usesDensityRecipe,
        tokens: [...leftEntry.tokens, ...rightEntry.tokens],
      })),
    );

  function classPossibilities(node) {
    if (!node) return [{ usesDensityRecipe: false, tokens: [] }];
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return classPossibilities(node.expression);
    }
    if (ts.isConditionalExpression(node)) {
      return [...classPossibilities(node.whenTrue), ...classPossibilities(node.whenFalse)];
    }
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        return [{ usesDensityRecipe: false, tokens: [] }, ...classPossibilities(node.right)];
      }
      if (
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return [...classPossibilities(node.left), ...classPossibilities(node.right)];
      }
      return combine(classPossibilities(node.left), classPossibilities(node.right));
    }
    if (ts.isCallExpression(node)) {
      return node.arguments.reduce(
        (possibilities, argument) => combine(possibilities, classPossibilities(argument)),
        [{ usesDensityRecipe: false, tokens: [] }],
      );
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.reduce(
        (possibilities, element) => combine(possibilities, classPossibilities(element)),
        [{ usesDensityRecipe: false, tokens: [] }],
      );
    }
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return [{ usesDensityRecipe: false, tokens: splitUtilityTokens(node.text).map(utilityBase) }];
    }
    if (ts.isTemplateExpression(node)) {
      const tokens = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)]
        .flatMap(splitUtilityTokens)
        .map(utilityBase);
      return [{ usesDensityRecipe: false, tokens }];
    }
    const expressionText = node.getText(source);
    return [{ usesDensityRecipe: /\bmetadataPill(?:Density)?\b/.test(expressionText), tokens: [] }];
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classAttribute = jsxClassAttribute(node, source);
      if (!classAttribute || !ts.isJsxAttribute(classAttribute)) {
        ts.forEachChild(node, visit);
        return;
      }
      const initializer = classAttribute.initializer;
      const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
      const tag = node.tagName.getText(source);
      const conflicting = classPossibilities(expression).flatMap((possibility) => {
        if (tag !== "Chip" && !possibility.usesDensityRecipe) return [];
        return possibility.tokens.filter(
          (token) => DENSITY_HEIGHT_UTILITY.test(token) || DENSITY_TEXT_UTILITY.test(token),
        );
      });
      if (conflicting.length > 0) {
        const line = source.getLineAndCharacterOfPosition(classAttribute.getStart(source)).line + 1;
        findings.push(`${relativePath}:${line} (${[...new Set(conflicting)].join(", ")})`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

export function findHardcodedMotionClassesInSource(relativePath, sourceText) {
  return staticUtilityTokensInSource(relativePath, sourceText)
    .filter(({ token }) => {
      const base = utilityBase(token);
      return base === "transition-all" || HARDCODED_MOTION_UTILITY.test(base);
    })
    .map(({ token, line }) => `${relativePath}:${line} (${token})`);
}

export function findLayoutTransitionClassesInSource(relativePath, sourceText) {
  return staticUtilityTokensInSource(relativePath, sourceText).flatMap(({ token, line }) => {
    const match = utilityBase(token).match(/^transition-\[([^\]]+)\]$/);
    if (!match) return [];
    return match[1]
      .split(/[,_]/)
      .filter((property) => LAYOUT_TRANSITION_PROPERTIES.has(property))
      .map((property) => ({ relativePath, line, property }));
  });
}

export function findUnapprovedZIndexClassesInSource(relativePath, sourceText) {
  return staticUtilityTokensInSource(relativePath, sourceText).flatMap(({ token, line }) => {
    const match = utilityBase(token).match(/^(-?)z-(?:\[(-?\d+)\]|(-?\d+))$/);
    if (!match) return [];
    const value = Number(`${match[1]}${match[2] ?? match[3]}`);
    return ALLOWED_Z_INDEX_RUNGS.has(value) ? [] : [`${relativePath}:${line} (${token})`];
  });
}

export function countLegacyPaletteUtilitiesInSource(relativePath, sourceText) {
  return staticUtilityTokensInSource(relativePath, sourceText).filter(({ token }) =>
    LEGACY_PALETTE_UTILITY.test(utilityBase(token)),
  ).length;
}

export function countDarkColorOverridesInSource(relativePath, sourceText) {
  return staticUtilityTokensInSource(relativePath, sourceText).filter(({ token }) => {
    const variants = utilityVariants(token);
    return variants.includes("dark") && COLOR_UTILITY.test(utilityBase(token));
  }).length;
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

export function countOnePixelShadowSpreadsInSource(sourceText) {
  let count = 0;
  const declaration = /(?:box-shadow|--(?:e[0-4]|shadow-[a-z0-9-]+))\s*:\s*([^;{}]+);/gi;
  for (const match of sourceText.matchAll(declaration)) {
    count += splitCssShadowLayers(match[1]).filter(layerHasOnePixelSpread).length;
  }
  const arbitraryShadow = /shadow-\[([^\]]+)\]/g;
  for (const match of sourceText.matchAll(arbitraryShadow)) {
    count += splitCssShadowLayers(match[1].replaceAll("_", " ")).filter(layerHasOnePixelSpread).length;
  }
  return count;
}

export function countHardcodedCssMotionDurations(sourceText) {
  let count = 0;
  const declaration = /(?:transition|animation)(?:-duration|-delay)?\s*:\s*([^;{}]+);/gi;
  for (const match of sourceText.matchAll(declaration)) {
    const value = match[1];
    for (const duration of value.matchAll(/(?<![-\w])\d*\.?\d+(?:ms|s)\b/g)) {
      count += 1;
    }
  }
  return count;
}

export function findCssLayoutTransitionsInSource(relativePath, sourceText) {
  const findings = [];
  const declaration = /transition(?:-property)?\s*:\s*([^;{}]+);/gi;
  for (const match of sourceText.matchAll(declaration)) {
    const line = sourceText.slice(0, match.index).split(/\r?\n/).length;
    for (const property of LAYOUT_TRANSITION_PROPERTIES) {
      const pattern = new RegExp(`(?:^|[,\\s])${property.replaceAll("-", "\\-")}(?=[,\\s]|$)`);
      if (pattern.test(match[1])) findings.push({ relativePath, line, property });
    }
  }
  return findings;
}

export function countRawCssZIndicesInSource(sourceText) {
  return [...sourceText.matchAll(/z-index\s*:\s*(?:-?\d+)\s*;/gi)].length;
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
