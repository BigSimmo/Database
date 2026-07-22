import ts from "@typescript/typescript6";

const LEGACY_TAP_TOKEN_SOURCE = String.raw`(?:[^\s:"'\x60]+:)*(?:h|w|min-h|min-w|size)-11`;

export const LEGACY_TAP_CLASS = new RegExp(`(?:^|[\\s\"'\\x60])${LEGACY_TAP_TOKEN_SOURCE}(?=[\\s\"'\\x60]|$)`, "g");
const LEGACY_TAP_CLASS_TEST = new RegExp(`(?:^|[\\s\"'\\x60])${LEGACY_TAP_TOKEN_SOURCE}(?=[\\s\"'\\x60]|$)`);

export const RAW_COLOR_EXEMPTIONS = [
  { category: "global theme tokens", pattern: /^src\/app\/globals\.css$/, scope: "whole-file" },
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
    category: "printable Therapy paper",
    pattern: /^src\/components\/therapy-compass\/therapy-compass\.css$/,
    scope: "therapy-paper",
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

  if (exemption.scope === "therapy-paper") {
    const ranges = [balancedBlockRange(source, ".tc-paper {"), balancedBlockRange(source, "@media print {")];
    if (ranges.some((range) => !range)) {
      reportFailure("printable Therapy paper raw-color boundaries are missing");
      return source;
    }
    return maskRanges(source, ranges);
  }

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
