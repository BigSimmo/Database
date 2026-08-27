import ts from "@typescript/typescript6";
import postcss from "postcss";

const LEGACY_TAP_TOKEN_SOURCE = String.raw`(?:[^\s:"'\x60]+:)*(?:h|w|min-h|min-w|size)-11`;
const CSS_WHITESPACE = String.raw`(?:\s|\/\*[\s\S]*?\*\/)*`;
const TEXT_SOFT_CONSUMER = new RegExp(
  String.raw`\bvar\s*\(${CSS_WHITESPACE}--text-soft(?=${CSS_WHITESPACE}(?:,|\)))`,
  "g",
);

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

export function findTextSoftConsumersInSource(relativePath, sourceText) {
  const findings = [];

  function recordMatches(fragment, lineOffset = 0) {
    for (const match of fragment.matchAll(TEXT_SOFT_CONSUMER)) {
      const line = lineOffset + fragment.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${relativePath}:${line}`);
    }
  }

  if (relativePath.endsWith(".css")) {
    for (const declaration of cssDeclarations(sourceText)) {
      const value = maskCssValueTrivia(declaration.value);
      const lineOffset =
        (declaration.source?.start?.line ?? 1) - 1 + (declaration.raws.between.match(/\r?\n/g)?.length ?? 0);
      recordMatches(value, lineOffset);
    }
    return findings;
  }

  const languageVariant = relativePath.endsWith(".tsx") ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, languageVariant, sourceText);
  const commentTokens = new Set([ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia]);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (commentTokens.has(token)) continue;
    const tokenText = scanner.getTokenText();
    const tokenOffset = scanner.getTokenPos();
    const tokenLineOffset = sourceText.slice(0, tokenOffset).split(/\r?\n/).length - 1;
    recordMatches(tokenText, tokenLineOffset);
  }

  return findings;
}

function maskCssValueTrivia(value) {
  const masked = [...value];
  let quote = null;
  let inComment = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (inComment) {
      if (character !== "\r" && character !== "\n") masked[index] = " ";
      if (character === "*" && next === "/") {
        masked[index + 1] = " ";
        index += 1;
        inComment = false;
      }
      continue;
    }

    if (quote) {
      if (character !== "\r" && character !== "\n") masked[index] = " ";
      if (character === "\\" && next !== undefined) {
        if (next !== "\r" && next !== "\n") masked[index + 1] = " ";
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "/" && next === "*") {
      masked[index] = " ";
      masked[index + 1] = " ";
      index += 1;
      inComment = true;
    } else if (character === '"' || character === "'") {
      masked[index] = " ";
      quote = character;
    }
  }

  return masked.join("");
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

/**
 * Gate 2's remaining named case: an interactive control that declares its OWN
 * minimum height below the 48px tap floor.
 *
 * Scoped to `min-h-*` deliberately, and NOT to `h-*`/`size-*`. A short `h-4` on
 * an interactive element is frequently the *visible* box of a control whose hit
 * area is owned by a tap-sized wrapper — `SelectionCheckbox` in
 * `differentials-home.tsx` is exactly that, and `ui-smoke` asserts the label
 * around it still meets the floor. Flagging those would pad the baseline with
 * findings that are not defects, which GATES.md §5 calls out as the way a gate
 * gets switched off. `min-h-*` carries no such ambiguity: it is the element's
 * own declared floor, so a value under the token is a lowered tap target by
 * construction.
 *
 * Unprefixed only. `min-h-12 sm:min-h-10` is the repo's correct pattern — 48px
 * on phones, 40px from `sm` up — so a variant-prefixed short value is a
 * deliberate desktop release, not a violation. An unprefixed `min-h-tap` or
 * `min-h-12`+ on the same element rescues it.
 */
const TAP_FLOOR_INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "summary", "textarea"]);
const MAX_CLASS_ALTERNATIVES = 128;

function combineClassAlternatives(left, right) {
  const combined = [];
  for (const first of left) {
    for (const second of right) {
      combined.push(`${first} ${second}`.trim());
      if (combined.length >= MAX_CLASS_ALTERNATIVES) return [...new Set(combined)];
    }
  }
  return [...new Set(combined)];
}

function classExpressionAlternatives(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    return classExpressionAlternatives(node.expression);
  }
  if (ts.isSatisfiesExpression?.(node)) return classExpressionAlternatives(node.expression);
  if (ts.isConditionalExpression(node)) {
    return [
      ...new Set([...classExpressionAlternatives(node.whenTrue), ...classExpressionAlternatives(node.whenFalse)]),
    ];
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [...new Set(["", ...classExpressionAlternatives(node.right)])];
    }
    if (
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [...new Set([...classExpressionAlternatives(node.left), ...classExpressionAlternatives(node.right)])];
    }
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return combineClassAlternatives(classExpressionAlternatives(node.left), classExpressionAlternatives(node.right));
    }
    return [""];
  }
  if (ts.isTemplateExpression(node)) {
    let alternatives = [node.head.text];
    for (const span of node.templateSpans) {
      alternatives = combineClassAlternatives(alternatives, classExpressionAlternatives(span.expression));
      alternatives = alternatives.map((value) => `${value}${span.literal.text}`);
    }
    return alternatives;
  }
  if (ts.isCallExpression(node) || ts.isArrayLiteralExpression(node)) {
    const values = ts.isCallExpression(node) ? node.arguments : node.elements;
    return values.reduce(
      (alternatives, value) => combineClassAlternatives(alternatives, classExpressionAlternatives(value)),
      [""],
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.reduce(
      (alternatives, property) => {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return alternatives;
        const name = property.name;
        const className =
          name && (ts.isStringLiteralLike(name) || ts.isIdentifier(name) || ts.isNumericLiteral(name)) ? name.text : "";
        return className ? combineClassAlternatives(alternatives, ["", className]) : alternatives;
      },
      [""],
    );
  }
  return [""];
}

function jsxClassAlternatives(attribute) {
  const initializer = attribute.initializer;
  if (!initializer) return [];
  if (ts.isStringLiteral(initializer)) return [initializer.text];
  if (!ts.isJsxExpression(initializer) || !initializer.expression) return [];
  return classExpressionAlternatives(initializer.expression);
}

function minHeightPixels(token) {
  const normalized = token.replace(/^!/, "");
  if (normalized === "min-h-tap") return 48;
  if (normalized === "min-h-px") return 1;
  const spacing = normalized.match(/^min-h-(\d+(?:\.\d+)?)$/);
  if (spacing) return Number(spacing[1]) * 4;
  const arbitrary = normalized.match(/^min-h-\[(-?\d+(?:\.\d+)?)(px|rem)\]$/);
  if (!arbitrary) return null;
  const value = Number(arbitrary[1]);
  return arbitrary[2] === "rem" ? value * 16 : value;
}

function hasSubFloorEffectiveMinHeight(classText) {
  const minHeightTokens = classText
    .split(/\s+/)
    .filter((token) => token && !token.includes(":"))
    .map((token) => token.replace(/^!/, ""))
    .filter((token) => token.startsWith("min-h-"));
  if (minHeightTokens.length === 0) return false;
  const pixels = minHeightPixels(minHeightTokens.at(-1));
  return pixels !== null && pixels < 48;
}

export function findInteractiveTapFloorDeclarationsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx")) return [];
  if (!/\bmin-h-(?:[0-9]|1[01]|\[)/.test(sourceText)) return [];
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  function inspectOpeningElement(node) {
    if (!TAP_FLOOR_INTERACTIVE_TAGS.has(node.tagName.getText(source))) return;
    const classAttribute = node.attributes.properties.find(
      (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className",
    );
    if (!classAttribute || !ts.isJsxAttribute(classAttribute)) return;
    const alternatives = jsxClassAlternatives(classAttribute);
    if (!alternatives.some(hasSubFloorEffectiveMinHeight)) return;
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
// The status-colour family declared in `globals.css` (`--success`/`--warning`/
// `--danger`/`--info` and their -text/-bg/-soft/-border/-solid variants). These
// four hues are the ones GATES.md §3 reserves for state; `--decoration-soft` is
// deliberately absent because it carries no state and painting with it is not
// the defect either rule below is looking for.
const STATUS_COLOR_TOKEN = String.raw`--(?:success|warning|danger|info)(?:-(?:text|bg|soft|border|solid(?:-(?:hover|active|contrast))?))?`;
/**
 * The optional Tailwind opacity modifier. Leaving it out was a real hole, not a
 * theoretical one: 83 status-token utilities in `src` carry a `/NN` suffix, and
 * an anchored pattern without it rejected every one of them before the semantic
 * checks ran — so an indicator written `bg-[color:var(--danger)]/90` walked past
 * a ratchet claiming to be repository-wide.
 */
const STATUS_ALPHA_MODIFIER = String.raw`(?:/(?:\d+(?:\.\d+)?|\[[^\]]+\]))?`;
const STATUS_TEXT_UTILITY = new RegExp(
  String.raw`^text-\[(?:color:)?var\(${STATUS_COLOR_TOKEN}\)\]${STATUS_ALPHA_MODIFIER}$`,
);
/** A status hue as a *surface* — the decorative form, with no text of its own. */
const STATUS_SURFACE_UTILITY = new RegExp(
  String.raw`^(?:bg|border(?:-[xytrblse])?|ring|outline|fill|stroke)-\[(?:color:)?var\(${STATUS_COLOR_TOKEN}\)\]${STATUS_ALPHA_MODIFIER}$`,
);
/** Digits and the separators a figure or range carries, with no letters. */
const NUMERAL_PUNCTUATION = /^[\s\d.,:%+\-–—/×xX()]*$/;
/**
 * Unit words a clinical figure may carry. An explicit list, because the
 * alternative — allowing any short alphabetic run after a digit — would read
 * "12 errors" as a numeral and re-create in text the false positive the
 * expression classifier was already fixed for.
 */
const NUMERAL_UNIT =
  /^(?:mg|mcg|ug|µg|ng|g|kg|mL|L|dL|mmol|mol|mEq|IU|U|mmHg|kPa|bpm|ms|sec|s|min|h|hr|hrs|d|day|days|wk|week|weeks|mo|month|months|yr|year|years|per|m|cm|kcal|mg\/kg)$/i;

/**
 * Whether a JSX text fragment is part of a figure rather than prose: "12",
 * "1.5 mg", "40–60%", "3/7", "10 mg/day", and the bare " mg" left beside a
 * `{dose}` expression. Any alphabetic run must be a unit; a word that is not one
 * is prose, and prose is its own non-colour channel.
 *
 * Deliberately no digit requirement — `{dose} mg` splits into an expression and
 * a unit-only text child, and demanding a digit in every fragment would let the
 * commonest clinical shape of all slip past.
 *
 * The earlier form of this rejected *every* letter while its own comment claimed
 * units were covered, so a dose painted in a status colour — the single case
 * this rule exists for — passed silently.
 */
function isNumeralTextFragment(text) {
  const trimmed = text.trim();
  if (trimmed === "") return true;
  const alphabeticRuns = trimmed.match(/[A-Za-zµ]+/g) ?? [];
  if (!alphabeticRuns.every((run) => NUMERAL_UNIT.test(run))) return false;
  return NUMERAL_PUNCTUATION.test(trimmed.replace(/[A-Za-zµ]+/g, ""));
}
/**
 * The trailing name segment of an expression that is a figure by definition.
 * Kept deliberately short. A looser list (`value`, `amount`, `size`, `index`,
 * `num`) was measured first and flagged an icon wrapper whose child expression
 * merely mentioned `size` — the exact false positive that would have forced an
 * exemption onto a rule that had not yet caught a single real defect.
 */
const NUMERAL_NAME = /^(?:count|total|length|score|dose|percent|pct|qty|quantity)$/i;
/** Methods that exist to render a number as text. */
const NUMERAL_METHOD = /^(?:toFixed|toLocaleString|toPrecision)$/;
const DENSITY_HEIGHT_UTILITY = /^(?:h|min-h|max-h|size)-/;
const DENSITY_TEXT_UTILITY = /^text-(?:2xs|xs|sm-minus|sm|base|lg|xl|[2-9]xl|\[[^\]]*(?:px|rem|em|clamp\()[^\]]*\])$/;
const HARDCODED_MOTION_UTILITY = /^(?:duration|delay)-(?:\d+|\[(?!var\(--duration-)[^\]]+\])$/;
const LITERAL_SHADOW_UTILITY = /^shadow-\[(?!var\()[^\]]+\]$/;
/**
 * Tailwind's inversion filters. A PDF page, a diagram or a clinical photograph
 * carries meaning in its own colours — inverting it to suit a dark theme changes
 * what the reader sees, and on a radiograph or a stained slide that is a clinical
 * error, not a styling one (GATES.md §3). Production carries none of these today,
 * so this is a hard zero rather than a ratchet.
 *
 * `-0` is excluded: `invert-0` and `hue-rotate-0` *disable* inversion, and a
 * hard-zero gate that rejects the reset would block the very fix it wants.
 */
const IMAGE_INVERSION_UTILITY = /^-?(?:backdrop-)?(?:invert|hue-rotate)(?:-(?!0$)(?:\d+|\[[^\]]+\]))?$/;
/**
 * The same filters written as arbitrary values — `filter-[invert(1)]`,
 * `[filter:invert(1)]`, and their `backdrop-` forms, all of which compile under
 * the installed Tailwind and none of which the dedicated-utility pattern above
 * can see. Matching the function call itself covers every spelling at once, and
 * cannot collide with an ordinary utility: no other class contains `invert(`.
 */
const INVERSION_FUNCTION = /(?:invert|hue-rotate)\(/;
// Same shape as the literal-shadow ratchet, for the same reason: 371 arbitrary
// letterspacing values across 31 distinct spellings, seven of them positive steps
// between 0.04 and 0.16em that no reader can tell apart. `tracking-[var(--…)]` is
// the sanctioned token form and is deliberately NOT counted, exactly as
// `text-[color:var(--…)]` is exempt from the type-scale check.
const ARBITRARY_TRACKING_UTILITY = /^tracking-\[(?!var\()[^\]]+\]$/;
/**
 * Spacing, radius and line-height written as a bare literal — `px-[22px]`,
 * `rounded-[7px]`, `leading-[1.15]` — rather than picked off the scale.
 *
 * These deliberately exempt any arbitrary value containing a CSS *function*,
 * not just `var(`. `tracking-[var(--…)]` above can use the narrower `(?!var\()`
 * because letterspacing is only ever a token or a literal, but padding is not:
 * production carries `pb-[env(safe-area-inset-bottom)]`,
 * `pt-[max(0.75rem,var(--safe-area-top))]`, `pt-[clamp(1.5rem,5vh,3rem)]` and
 * `pb-[calc(7rem+env(safe-area-inset-bottom))]`. Those are computed from the
 * viewport or the safe-area inset, cannot be spelled as a scale step, and are
 * sanctioned. A `(?!var\()` lookahead would flag every one of them, because
 * they open with `max(`, `clamp(`, `env(` or `calc(` rather than `var(`.
 *
 * So the rule is: a value with no function call in it at all is a raw literal.
 * That keeps the sanctioned computed forms out without enumerating them.
 */
const RAW_LITERAL_VALUE = String.raw`\[(?![^\]]*\w\()[^\]]+\]`;
const RAW_PADDING_UTILITY = new RegExp(String.raw`^p[xytrbles]?-${RAW_LITERAL_VALUE}$`);
const RAW_RADIUS_UTILITY = new RegExp(
  String.raw`^rounded(?:-(?:[trblse]|[tb][lr]|ss|se|ee|es))?-${RAW_LITERAL_VALUE}$`,
);
const RAW_LINE_HEIGHT_UTILITY = new RegExp(String.raw`^leading-${RAW_LITERAL_VALUE}$`);
/**
 * Gap, on the same predicate and for the same reason as padding.
 *
 * Added after the padding/radius/line-height families rather than alongside
 * them, because gap was the one remaining spacing surface a hand-picked value
 * could hide in: `gap-[9px]` was counted by no ratchet at all. 21 sites, every
 * one under `src/components/therapy-compass/`.
 *
 * Its own metric rather than folded into `rawPaddingLiterals`, so the
 * therapy-compass cleanup can be paid down and re-pinned on its own — the
 * padding debt is spread over fifteen unrelated files and will move at a
 * different pace.
 */
const RAW_GAP_UTILITY = new RegExp(String.raw`^gap(?:-[xy])?-${RAW_LITERAL_VALUE}$`);
/**
 * Margin, completing the spacing family. Padding, radius, gap and line-height
 * were each given a ratchet; margin was simply never added, so `mb-[22px]`,
 * `mt-[30px]` and 41 more sat in production counted by nothing. Found by the
 * 2026-08-20 design review, which noted the omission is the reason
 * therapy-compass reads as off the shared spacing grid while its padding and
 * gap debt is already pinned.
 *
 * Own metric, for the same reason gap got one: this debt is concentrated in a
 * different set of files and will be paid down at its own pace.
 */
const RAW_MARGIN_UTILITY = new RegExp(String.raw`^-?m[xytrbles]?-${RAW_LITERAL_VALUE}$`);
/**
 * The CSS-declaration half of the same four rules, so a literal cannot simply
 * move from a class into `globals.css` to escape the ratchet — the same reason
 * `legacyShadowAliases` and the colour ratchet count both sides.
 *
 * `0` in any unit carries no design decision and is exempt, as are the CSS-wide
 * keywords and `line-height: normal`. The zero matcher takes any CSS unit
 * identifier (`0dvh`, `0svw`, `0cqw`, `0lh`, …), not a finite allowlist — a
 * closed list falsely counted those as raw debt.
 *
 * Tailwind's arbitrary-property spelling (`[padding:22px]`,
 * `[border-radius:7px]`, `[line-height:1.35]`) reaches the same properties as
 * the named utilities above and is counted with the same raw-literal predicate,
 * or the ratchet could be bypassed by changing syntax alone.
 */
const RAW_PADDING_PROPERTY = /^padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$/;
const RAW_RADIUS_PROPERTY = /^border(?:-(?:top|bottom)-(?:left|right)|-(?:start|end)-(?:start|end))?-radius$/;
/** `gap` is the shorthand; `row-gap`/`column-gap` are the longhands it expands to. */
const RAW_GAP_PROPERTY = /^(?:gap|row-gap|column-gap)$/;
/**
 * Margin, matching the padding shape. Both the `[margin-top:22px]` arbitrary-property
 * utility and a plain `margin-top: 22px` declaration route through
 * `recordRawScaleLiteralProperty`, so one branch closes both spellings at once.
 */
const RAW_MARGIN_PROPERTY = /^margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$/;
const CSS_WIDE_KEYWORD = /^(?:inherit|initial|unset|revert|revert-layer|normal|auto)$/;
const CSS_ZERO_VALUE = /^-?0(?:\.0+)?(?:[a-z%]+)?$/i;
const ARBITRARY_PROPERTY_UTILITY = /^\[([a-z-]+):([^\]]+)\]$/i;

function isRawScaleLiteralValue(value) {
  const trimmed = value.trim();
  if (!trimmed || /\w\(/.test(trimmed) || CSS_WIDE_KEYWORD.test(trimmed)) return false;
  return !trimmed.split(/\s+/).every((part) => CSS_ZERO_VALUE.test(part));
}

function recordRawScaleLiteralProperty(result, relativePath, line, prop, value, token) {
  if (!isRawScaleLiteralValue(value)) return;
  const label = token ?? `${prop}: ${value}`;
  if (RAW_PADDING_PROPERTY.test(prop)) {
    result.rawPaddingLiterals.push(`${relativePath}:${line} (${label})`);
  }
  if (RAW_RADIUS_PROPERTY.test(prop)) {
    result.rawRadiusLiterals.push(`${relativePath}:${line} (${label})`);
  }
  if (RAW_GAP_PROPERTY.test(prop)) {
    result.rawGapLiterals.push(`${relativePath}:${line} (${label})`);
  }
  if (RAW_MARGIN_PROPERTY.test(prop)) {
    result.rawMarginLiterals.push(`${relativePath}:${line} (${label})`);
  }
  if (prop === "line-height") {
    result.rawLineHeightLiterals.push(`${relativePath}:${line} (${label})`);
  }
}
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
  // The individual transform properties. Tailwind 4 compiles `translate-*`,
  // `scale-*` and `rotate-*` to these rather than to `transform`, so a
  // transition list that names them is the same compositor-only animation
  // `transform` already covers — it cannot trigger layout. Omitting them made
  // this ratchet flag the phone chrome's `transition-[transform,translate,
  // opacity]` as layout debt alongside genuine `grid-template-rows`/`height`
  // entries, which is the opposite of what the metric measures.
  "translate",
  "scale",
  "rotate",
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
  const scopeByNode = new WeakMap();
  const rootScope = { bindings: new Map(), functionScope: true, parent: null };
  const blockedBinding = Symbol("blocked binding");

  function addBinding(scope, name, binding) {
    const existing = scope.bindings.get(name) ?? [];
    existing.push(binding);
    scope.bindings.set(name, existing);
  }

  function bindingScopeForVariable(node, scope) {
    const declarationList = node.parent;
    if (!ts.isVariableDeclarationList(declarationList)) return scope;
    if (declarationList.flags & ts.NodeFlags.BlockScoped) return scope;
    let target = scope;
    while (target.parent && !target.functionScope) target = target.parent;
    return target;
  }

  function createsScope(node) {
    if (ts.isFunctionLike(node)) return { functionScope: true };
    if ((ts.isBlock(node) && !ts.isFunctionLike(node.parent)) || ts.isCaseBlock(node)) {
      return { functionScope: false };
    }
    if (ts.isCatchClause(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      return { functionScope: false };
    }
    return null;
  }

  function collectBindings(node, parentScope) {
    const scopeKind = node === source ? null : createsScope(node);
    const scope = scopeKind
      ? { bindings: new Map(), functionScope: scopeKind.functionScope, parent: parentScope }
      : parentScope;
    scopeByNode.set(node, scope);

    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      const namedBindings = node.importClause.namedBindings;
      if (ts.isNamespaceImport(namedBindings)) {
        addBinding(scope, namedBindings.name.text, {
          declaration: namedBindings,
          densityRecipe: false,
          initializer: null,
          namespaceImport: true,
          start: namedBindings.name.getStart(source),
        });
      } else if (ts.isNamedImports(namedBindings)) {
        for (const specifier of namedBindings.elements) {
          const imported = specifier.propertyName?.text ?? specifier.name.text;
          addBinding(scope, specifier.name.text, {
            declaration: specifier,
            densityRecipe: imported === "metadataPill" || imported === "metadataPillDensity",
            initializer: null,
            namespaceImport: false,
            start: specifier.name.getStart(source),
          });
        }
      }
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      addBinding(scope, node.name.text, {
        declaration: node,
        densityRecipe: false,
        initializer: node.initializer ?? null,
        start: node.name.getStart(source),
      });
    }
    if (ts.isVariableDeclaration(node)) {
      const targetScope = bindingScopeForVariable(node, scope);
      if (ts.isIdentifier(node.name)) {
        addBinding(targetScope, node.name.text, {
          declaration: node,
          densityRecipe: false,
          initializer: node.initializer ?? null,
          namespaceImport: false,
          start: node.name.getStart(source),
        });
      } else if (ts.isObjectBindingPattern(node.name) && node.initializer) {
        for (const element of node.name.elements) {
          if (!ts.isIdentifier(element.name)) continue;
          addBinding(targetScope, element.name.text, {
            declaration: element,
            densityRecipe: false,
            destructuredFrom: node.initializer,
            initializer: element.initializer ?? null,
            namespaceImport: false,
            start: element.name.getStart(source),
          });
        }
      }
    }
    ts.forEachChild(node, (child) => collectBindings(child, scope));
  }
  collectBindings(source, rootScope);

  function resolveBinding(identifier) {
    let scope = scopeByNode.get(identifier) ?? rootScope;
    const referenceStart = identifier.getStart(source);
    while (scope) {
      const candidates = scope.bindings.get(identifier.text);
      if (candidates?.length) {
        const preceding = candidates.filter((candidate) => candidate.start <= referenceStart).at(-1);
        return preceding ?? blockedBinding;
      }
      scope = scope.parent;
    }
    return null;
  }

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
      const binding = resolveBinding(node);
      if (binding === blockedBinding) return empty();
      if (!binding && (node.text === "metadataPill" || node.text === "metadataPillDensity")) {
        return [{ usesDensityRecipe: true, tokens: [] }];
      }
      if (!binding) return empty();
      if (binding.densityRecipe) return [{ usesDensityRecipe: true, tokens: [] }];
      if (resolving.has(binding)) return empty();
      const next = new Set(resolving);
      next.add(binding);
      if (binding.destructuredFrom) {
        const sourcePossibilities = possibilities(binding.destructuredFrom, next);
        if (sourcePossibilities.some((entry) => entry.usesDensityRecipe)) {
          return [{ usesDensityRecipe: true, tokens: [] }];
        }
      }
      if (!binding.initializer) return empty();
      return possibilities(binding.initializer, next);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const expressionPossibilities = possibilities(node.expression, resolving);
      if (expressionPossibilities.some((entry) => entry.usesDensityRecipe)) {
        return [{ usesDensityRecipe: true, tokens: [] }];
      }
      if (ts.isIdentifier(node.expression)) {
        const binding = resolveBinding(node.expression);
        if (
          binding &&
          binding !== blockedBinding &&
          binding.namespaceImport &&
          (node.name.text === "metadataPill" || node.name.text === "metadataPillDensity")
        ) {
          return [{ usesDensityRecipe: true, tokens: [] }];
        }
        if (binding && binding !== blockedBinding && binding.initializer && !resolving.has(binding)) {
          const initializer = binding.initializer;
          const unwrapped = ts.isAsExpression(initializer) ? initializer.expression : initializer;
          const property = ts.isObjectLiteralExpression(unwrapped)
            ? unwrapped.properties.find(
                (candidate) =>
                  ts.isPropertyAssignment(candidate) &&
                  ((ts.isIdentifier(candidate.name) && candidate.name.text === node.name.text) ||
                    (ts.isStringLiteralLike(candidate.name) && candidate.name.text === node.name.text)),
              )
            : null;
          if (property && ts.isPropertyAssignment(property)) {
            const next = new Set(resolving);
            next.add(binding);
            return possibilities(property.initializer, next);
          }
        }
      }
      return empty();
    }
    if (ts.isElementAccessExpression(node)) {
      const expressionPossibilities = possibilities(node.expression, resolving);
      if (expressionPossibilities.some((entry) => entry.usesDensityRecipe)) {
        return [{ usesDensityRecipe: true, tokens: [] }];
      }
      if (!ts.isIdentifier(node.expression)) return empty();
      const binding = resolveBinding(node.expression);
      if (!binding || binding === blockedBinding || !binding.initializer || resolving.has(binding)) return empty();
      const initializer = ts.isAsExpression(binding.initializer) ? binding.initializer.expression : binding.initializer;
      if (!ts.isObjectLiteralExpression(initializer)) return empty();
      const requested = ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
      const next = new Set(resolving);
      next.add(binding);
      return initializer.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const propertyName =
          ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : null;
        if (requested !== null && propertyName !== requested) return [];
        return possibilities(property.initializer, next);
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

/** The tiny fixed box a status swatch is drawn at — `h-2 w-2`, `size-2`, and neighbours. */
const SWATCH_GEOMETRY = /^(?:h|w|size)-(?:1|1\.5|2|2\.5|3)$/;
/** Attributes that give an element a name a screen reader can announce. */
const ACCESSIBLE_NAME_ATTRIBUTES = new Set(["aria-label", "aria-labelledby", "title"]);

/**
 * Whether the element carries an accessible name with something actually in it.
 * `aria-label=""` names nothing, and accepting the attribute's mere presence let
 * an empty label exempt an indicator from the rule. A non-literal value
 * (`aria-label={label}`) is accepted, because without a type checker there is no
 * way to know it is empty and guessing would flag correct code.
 */
function hasNonEmptyAccessibleName(element, source) {
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    if (!ACCESSIBLE_NAME_ATTRIBUTES.has(attribute.name.getText(source))) continue;
    const initializer = attribute.initializer;
    // A bare `aria-label` with no value is empty by definition.
    if (!initializer) continue;
    if (ts.isStringLiteral(initializer)) {
      if (initializer.text.trim() !== "") return true;
      continue;
    }
    if (ts.isJsxExpression(initializer)) {
      const expression = initializer.expression;
      if (!expression) continue;
      if (ts.isStringLiteralLike(expression) && expression.text.trim() === "") continue;
      return true;
    }
  }
  return false;
}

/**
 * The element's own children, whitespace-only JSX text dropped. A self-closing
 * element has none by construction.
 */
function jsxOwnerChildren(owner) {
  if (!ts.isJsxOpeningElement(owner)) return [];
  const element = owner.parent;
  if (!element || !ts.isJsxElement(element)) return [];
  return element.children.filter((child) => !(ts.isJsxText(child) && child.text.trim() === ""));
}

/** Operators that produce a number. `+` is included and then guarded below. */
const ARITHMETIC_OPERATORS = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
]);

/** Whether any operand anywhere in the expression is literal text. */
function containsTextLiteral(node) {
  if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) return true;
  if (ts.isParenthesizedExpression(node)) return containsTextLiteral(node.expression);
  if (ts.isBinaryExpression(node)) return containsTextLiteral(node.left) || containsTextLiteral(node.right);
  return false;
}

function isNumeralExpression(node) {
  if (ts.isParenthesizedExpression(node)) return isNumeralExpression(node.expression);
  if (ts.isNumericLiteral(node)) return true;
  if (ts.isPrefixUnaryExpression(node)) {
    // Sign only. `!count` is a boolean, and treating it as a figure would let a
    // negation render as a "numeral" painted in a status colour.
    const signed = node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken;
    return signed && isNumeralExpression(node.operand);
  }
  if (ts.isBinaryExpression(node)) {
    // `{index + 1}` yes; `{count + " errors"}` no. The earlier note here — that
    // a concatenation "would have a string literal rather than a numeric one" —
    // was wrong, because one numeric side was enough to classify the whole
    // expression: the visible word "errors" IS the required non-colour channel,
    // so flagging it would have failed CI on a correct surface. Comparison and
    // logical operators are excluded for the same reason: they yield booleans.
    if (!ARITHMETIC_OPERATORS.has(node.operatorToken.kind)) return false;
    if (containsTextLiteral(node)) return false;
    return isNumeralExpression(node.left) || isNumeralExpression(node.right);
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    return ts.isPropertyAccessExpression(callee) && NUMERAL_METHOD.test(callee.name.text);
  }
  if (ts.isPropertyAccessExpression(node)) return NUMERAL_NAME.test(node.name.text);
  if (ts.isIdentifier(node)) return NUMERAL_NAME.test(node.text);
  return false;
}

/**
 * True when every child reads as a figure rather than prose. An element with no
 * children at all is not a numeral — that case is the colour-only indicator rule
 * below, and letting both fire on one element is how a rule earns an exemption.
 */
function childrenAreNumeralOnly(children) {
  if (children.length === 0) return false;
  let sawNumeral = false;
  for (const child of children) {
    if (ts.isJsxText(child)) {
      const text = child.text.trim();
      if (!isNumeralTextFragment(text)) return false;
      if (/\d/.test(text)) sawNumeral = true;
      continue;
    }
    if (ts.isJsxExpression(child)) {
      if (!child.expression) continue;
      if (!isNumeralExpression(child.expression)) return false;
      sawNumeral = true;
      continue;
    }
    // A nested element (icon, badge, another span) means this node is a
    // container, not a painted numeral.
    return false;
  }
  return sawNumeral;
}

/**
 * Whether a JSX child renders words a reader can see.
 *
 * Expressions are treated as text by default, because without a type checker
 * `{label}` and `{count}` are indistinguishable and assuming the worst would
 * flag every labelled swatch in the repository. The exclusions below are the
 * cases that are *statically* not text: a rendered-nothing literal, and a bare
 * element such as an icon, which is another colour/shape channel rather than a
 * second one.
 */
function rendersVisibleText(node) {
  if (ts.isJsxText(node)) return /[A-Za-z]/.test(node.text);
  if (ts.isJsxElement(node)) return node.children.some(rendersVisibleText);
  if (ts.isJsxFragment(node)) return node.children.some(rendersVisibleText);
  if (ts.isJsxSelfClosingElement(node)) return false;
  if (ts.isJsxExpression(node)) {
    const expression = node.expression;
    if (!expression) return false;
    if (
      expression.kind === ts.SyntaxKind.NullKeyword ||
      expression.kind === ts.SyntaxKind.FalseKeyword ||
      (ts.isIdentifier(expression) && expression.text === "undefined")
    ) {
      return false;
    }
    // If the expression builds markup — a conditional element, a `.map` over
    // rows — judge it by that markup. Otherwise it is a value being printed
    // (`{label}`, `{statusLabel(status)}`) and counts as text, because without a
    // type checker there is no way to tell a label from a count and assuming the
    // worst would flag every labelled swatch in the repository.
    const embedded = [];
    const collect = (child) => {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
        embedded.push(child);
        return;
      }
      ts.forEachChild(child, collect);
    };
    collect(expression);
    if (embedded.length > 0) return embedded.some(rendersVisibleText);
    return true;
  }
  return false;
}

/**
 * Whether a label sits beside the element rather than inside it. The legend
 * pattern — a coloured disc followed by the word it stands for, both inside one
 * flex row — is the single most common shape this rule meets, and it is already
 * correct: the state is in the text, and the swatch only repeats it in colour.
 * Without this the baseline would have carried ten legend swatches as debt and
 * taught the next reader that the rule cries wolf.
 */
function hasSiblingTextChannel(owner) {
  let self = ts.isJsxOpeningElement(owner) ? owner.parent : owner;
  let parent = self?.parent;
  // Climb out of the expression wrappers a conditional swatch sits in.
  // `{status === "emergent" ? <span …/> : null}` puts the element inside a
  // ConditionalExpression inside a JsxExpression, so it is not a direct child of
  // the element holding its label — and stopping at the first non-JSX parent
  // reported a labelled badge as colour-only.
  while (parent && !ts.isJsxElement(parent) && !ts.isJsxFragment(parent)) {
    self = parent;
    parent = parent.parent;
  }
  if (!parent) return false;
  return parent.children.some((child) => child !== self && rendersVisibleText(child));
}

/**
 * Whether the element, or any JSX element enclosing it, carries an accessible
 * name. The ancestor walk is what distinguishes a bare colour swatch from a
 * labelled composite: the services confidence bar paints three unlabelled
 * segments inside one `aria-label` that states all four counts, and flagging its
 * segments individually would be measuring markup rather than the defect.
 */
function hasAccessibleNameInScope(owner, source) {
  let node = owner;
  while (node) {
    // Walking upwards yields `JsxElement`, whose attributes live on its opening
    // element — checking only for opening/self-closing nodes silently never
    // matches an ancestor, which is how the first draft of this walk found
    // nothing at all.
    const element = ts.isJsxElement(node) ? node.openingElement : node;
    if (
      (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) &&
      hasNonEmptyAccessibleName(element, source)
    ) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

export function analyzeClassContractsInSource(relativePath, sourceText) {
  const analyzer = classExpressionAnalyzer(relativePath, sourceText);
  const result = {
    arbitraryTracking: [],
    colourOnlyStatusIndicators: [],
    darkColorOverrides: [],
    densityOverrides: [],
    edgeOwnershipConflicts: [],
    hardcodedMotionClasses: [],
    imageInversions: [],
    layoutTransitions: [],
    legacyShadowAliases: [],
    legacyTapClasses: [],
    legacyPaletteUtilities: [],
    literalShadowClasses: [],
    rawGapLiterals: [],
    rawMarginLiterals: [],
    rawLineHeightLiterals: [],
    rawPaddingLiterals: [],
    rawRadiusLiterals: [],
    statusColouredNumerals: [],
    typeStepUsages: [],
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

    // Status-colour boundary (GATES.md §3). Two distinct defects, one pass over
    // the same resolved class set, and deliberately mutually exclusive: a
    // numeral has children, a colour-only indicator has none.
    const rootBases = [...new Set(possibilities.flatMap((p) => p.tokens.map(({ token }) => utilityBase(token))))];
    const statusText = rootBases.filter((base) => STATUS_TEXT_UTILITY.test(base));
    const statusSurface = rootBases.filter((base) => STATUS_SURFACE_UTILITY.test(base));
    const rootLine = analyzer.source.getLineAndCharacterOfPosition(root.owner.getStart(analyzer.source)).line + 1;

    if (statusText.length > 0 && childrenAreNumeralOnly(jsxOwnerChildren(root.owner))) {
      result.statusColouredNumerals.push(`${relativePath}:${rootLine} (${statusText[0]})`);
    }

    if (statusSurface.length > 0 && root.tag !== "StatusMark") {
      const isJsxRoot = ts.isJsxOpeningElement(root.owner) || ts.isJsxSelfClosingElement(root.owner);
      if (isJsxRoot) {
        // A status hue painted on a box that says nothing: no children to read,
        // and no name on it or anything containing it. Colour is then the only
        // channel the state has.
        if (
          !hasAccessibleNameInScope(root.owner, analyzer.source) &&
          !hasSiblingTextChannel(root.owner) &&
          jsxOwnerChildren(root.owner).length === 0
        ) {
          result.colourOnlyStatusIndicators.push(`${relativePath}:${rootLine} (${statusSurface[0]})`);
        }
      } else if (root.tag === "recipe") {
        // A shared swatch recipe — a status hue plus a tiny round box and no text
        // utility. Its call sites inherit the defect, and the analyzer cannot see
        // across files to find them, so the recipe is where it is catchable.
        const swatch =
          rootBases.some((base) => SWATCH_GEOMETRY.test(base)) &&
          rootBases.includes("rounded-full") &&
          !rootBases.some((base) => base.startsWith("text-"));
        if (swatch) result.colourOnlyStatusIndicators.push(`${relativePath}:${rootLine} (${statusSurface[0]})`);
      }
    }

    for (const entry of uniqueTokenEntries(possibilities)) allTokens.set(entry.id, entry);
  }

  for (const { token, line } of allTokens.values()) {
    const base = utilityBase(token);
    const variants = utilityVariants(token);
    if (base === "transition-all" || HARDCODED_MOTION_UTILITY.test(base)) {
      result.hardcodedMotionClasses.push(`${relativePath}:${line} (${token})`);
    }
    if (IMAGE_INVERSION_UTILITY.test(base) || INVERSION_FUNCTION.test(base)) {
      result.imageInversions.push(`${relativePath}:${line} (${token})`);
    }
    if (LITERAL_SHADOW_UTILITY.test(base)) result.literalShadowClasses.push(`${relativePath}:${line} (${token})`);
    if (ARBITRARY_TRACKING_UTILITY.test(base)) result.arbitraryTracking.push(`${relativePath}:${line} (${token})`);
    if (RAW_PADDING_UTILITY.test(base)) result.rawPaddingLiterals.push(`${relativePath}:${line} (${token})`);
    if (RAW_RADIUS_UTILITY.test(base)) result.rawRadiusLiterals.push(`${relativePath}:${line} (${token})`);
    if (RAW_GAP_UTILITY.test(base)) result.rawGapLiterals.push(`${relativePath}:${line} (${token})`);
    if (RAW_MARGIN_UTILITY.test(base)) result.rawMarginLiterals.push(`${relativePath}:${line} (${token})`);
    if (RAW_LINE_HEIGHT_UTILITY.test(base)) result.rawLineHeightLiterals.push(`${relativePath}:${line} (${token})`);
    const arbitraryProperty = base.match(ARBITRARY_PROPERTY_UTILITY);
    if (arbitraryProperty) {
      recordRawScaleLiteralProperty(
        result,
        relativePath,
        line,
        arbitraryProperty[1].toLowerCase(),
        arbitraryProperty[2],
        token,
      );
    }
    // Every bare `text-<name>` this file uses, whatever `<name>` turns out to
    // mean. The caller decides which of these are type steps by reading the
    // `@theme` block, so the scale is never spelled out twice — writing the
    // step list here would make this module a second source of truth that
    // globals.css could drift away from silently.
    const bareTextUtility = base.match(/^text-([a-z0-9][a-z0-9-]*)$/);
    if (bareTextUtility) result.typeStepUsages.push(bareTextUtility[1]);
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
  result.colourOnlyStatusIndicators = [...new Set(result.colourOnlyStatusIndicators)];
  result.statusColouredNumerals = [...new Set(result.statusColouredNumerals)];
  return result;
}

export function findStatusColouredNumeralsInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).statusColouredNumerals;
}

export function findColourOnlyStatusIndicatorsInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).colourOnlyStatusIndicators;
}

export function findJsxEdgeOwnershipConflictsInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).edgeOwnershipConflicts;
}

const COMMAND_FILL = "bg-[color:var(--command)]";
const ELEVATION_TOKENS = [
  { match: /--shadow-lux\b/, rank: 4, lux: true },
  { match: /--e4\b/, rank: 4, lux: true },
  { match: /--e3\b/, rank: 3, lux: false },
  { match: /--e2\b/, rank: 2, lux: false },
  { match: /--shadow-soft\b/, rank: 2, lux: false },
  { match: /--e1\b/, rank: 1, lux: false },
  { match: /--e0\b/, rank: 0, lux: false },
  { match: /--shadow-inset\b/, rank: 0, lux: false },
];

function jsxOpening(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) return node;
  if (ts.isJsxElement(node)) return node.openingElement;
  return null;
}

function jsxTagName(opening) {
  return opening?.tagName?.getText?.() ?? "";
}

function jsxClassNameText(opening, source) {
  if (!opening) return "";
  const classAttribute = opening.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "className",
  );
  if (!classAttribute || !ts.isJsxAttribute(classAttribute)) return "";
  return `${jsxClassText(classAttribute)} ${classAttribute.getText(source)}`;
}

function elevationFromClassText(classText) {
  if (!classText) return null;
  let rank = null;
  let lux = false;
  for (const token of classText.split(/\s+/)) {
    if (/^(hover|focus-visible|forced-colors):/.test(token)) continue;
    for (const entry of ELEVATION_TOKENS) {
      if (entry.match.test(token)) {
        if (rank === null || entry.rank > rank) rank = entry.rank;
        if (entry.lux) lux = true;
      }
    }
  }
  return rank === null ? null : { rank, lux };
}

function elevationExcepted(classText, tag) {
  const hay = `${tag} ${classText}`;
  return /overlay|Sheet|glassOverlaySurface|\bpanel\b|shadow-lux|ring-highlight|lux/i.test(hay);
}

/**
 * Advisory AST: a child in-flow surface whose resting elevation token is heavier
 * than the nearest ancestor that also declares one. Overlays, Sheet, lux recipes,
 * and hover/focus-visible/forced-colors shadows are excluded.
 */
export function findElevationInversionsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx") && !relativePath.endsWith(".ts")) return [];
  if (relativePath.includes("/mockups/")) return [];
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  function visit(node) {
    const opening = jsxOpening(node);
    if (opening && opening === node) {
      const tag = jsxTagName(opening);
      const classText = jsxClassNameText(opening, source);
      const self = elevationFromClassText(classText);
      if (self && !self.lux && !elevationExcepted(classText, tag)) {
        let ancestor = node.parent;
        while (ancestor) {
          const parentOpening = jsxOpening(ancestor);
          if (parentOpening && parentOpening !== opening) {
            const parentTag = jsxTagName(parentOpening);
            const parentClass = jsxClassNameText(parentOpening, source);
            const parent = elevationFromClassText(parentClass);
            if (parent) {
              if (!parent.lux && !elevationExcepted(parentClass, parentTag) && self.rank > parent.rank) {
                const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
                findings.push(`${relativePath}:${line}`);
              }
              break;
            }
          }
          ancestor = ancestor.parent;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return [...new Set(findings)];
}

/**
 * Intrinsic `<button>` nodes whose className paints `--command` without going
 * through `Button` or `primaryControl`. The `Button` primitive itself is exempt.
 */
export function findHandRolledCommandButtonsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx")) return [];
  if (relativePath.includes("/mockups/")) return [];
  if (relativePath === "src/components/ui/button.tsx") return [];
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
      const hay = `${classText} ${classSource}`;
      if (hay.includes(COMMAND_FILL) && !/\bprimaryControl\b/.test(hay) && !/\bButton\b/.test(hay)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push(`${relativePath}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
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
    imageInversions: [],
    layoutTransitions: [],
    legacyShadowAliases: [],
    onePixelShadowSpreads: [],
    rawGapLiterals: [],
    rawLineHeightLiterals: [],
    rawMarginLiterals: [],
    rawPaddingLiterals: [],
    rawRadiusLiterals: [],
    rawZIndices: [],
  };
  for (const declaration of cssDeclarations(sourceText)) {
    const line = declaration.source?.start?.line ?? 1;
    const prop = declaration.prop.toLowerCase();
    // Custom-property declarations are the token definitions themselves — the
    // scale has to be written down somewhere — so only real properties count.
    if (!prop.startsWith("--")) {
      recordRawScaleLiteralProperty(result, relativePath, line, prop, declaration.value);
    }
    if (/^(?:-webkit-)?(?:backdrop-)?filter$/.test(prop)) {
      for (const match of declaration.value.matchAll(/\b(invert|hue-rotate)\(/g)) {
        result.imageInversions.push(`${relativePath}:${line} (${prop}: ${match[1]}())`);
      }
    }
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

export function findRawScaleLiteralClassesInSource(relativePath, sourceText) {
  const analysis = analyzeClassContractsInSource(relativePath, sourceText);
  return {
    padding: analysis.rawPaddingLiterals,
    radius: analysis.rawRadiusLiterals,
    gap: analysis.rawGapLiterals,
    margin: analysis.rawMarginLiterals,
    lineHeight: analysis.rawLineHeightLiterals,
  };
}

export function findTypeStepUsagesInSource(relativePath, sourceText) {
  return analyzeClassContractsInSource(relativePath, sourceText).typeStepUsages;
}

/**
 * ErrorState represents an unknown result, so its user-facing copy must never
 * manufacture a numeric result count. Keep this check at the shared component
 * boundary: callers can still explain what failed, but neither literal copy nor
 * a count expression can turn a failed request into an empty-result state.
 */
export function findErrorStateCountPropsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx") || !sourceText.includes("ErrorState")) return [];

  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const countBearingCopy =
    /\b\d+\s+(?:items?|matches?|records?|results?|sources?)\b|\b(?:item|match|record|result|source)?counts?\b|\btotal(?:Items?|Matches?|Records?|Results?|Sources?)?\b|\.(?:count|length)\b/i;

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(source).split(".").at(-1);
      if (tagName === "ErrorState") {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue;
          const propName = attribute.name.getText(source);
          if (propName !== "title" && propName !== "body") continue;
          const copy = attribute.initializer?.getText(source) ?? "";
          if (countBearingCopy.test(copy)) {
            const line = source.getLineAndCharacterOfPosition(attribute.getStart(source)).line + 1;
            findings.push(`${relativePath}:${line} (${propName})`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

/** Find count-bearing JSX rendered directly by an error/failed branch. */
export function findFailedStateResultCountsInSource(relativePath, sourceText) {
  if (!relativePath.endsWith(".tsx") || !/error|fail/i.test(sourceText)) return [];

  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const failureSignal =
    /\b(?:error|failed|failure|hasError|isError|loadError|requestError)\b|["'](?:error|failed)["']/i;
  const negatedFailureSignal = /!\s*(?:[\w.]*error|failed)|(?:[\w.]*error|failed)\s*={2,3}\s*(?:false|null|undefined)/i;
  const literalResultCount = /\b\d+\s+(?:items?|matches?|records?|results?|sources?)\b/i;
  const dynamicCount = String.raw`(?:\b(?:item|match|record|result|source)Counts?\b|\btotal(?:Items?|Matches?|Records?|Results?|Sources?)?\b|\.(?:count|length)\b|\bcount\s*=)`;
  const resultNoun = String.raw`\b(?:items?|matches?|records?|results?|sources?)\b`;
  const dynamicResultCount = new RegExp(
    String.raw`(?:${dynamicCount}[\s\S]{0,80}${resultNoun}|${resultNoun}[\s\S]{0,80}${dynamicCount})`,
    "i",
  );
  const conditionSignalsFailure = (condition) => failureSignal.test(condition) && !negatedFailureSignal.test(condition);
  const contains = (owner, candidate) =>
    candidate.getStart(source) >= owner.getStart(source) && candidate.getEnd() <= owner.getEnd();

  function isFailureBranch(node) {
    let child = node;
    for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
      if (
        ts.isConditionalExpression(parent) &&
        contains(parent.whenTrue, child) &&
        conditionSignalsFailure(parent.condition.getText(source))
      ) {
        return true;
      }
      if (
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        contains(parent.right, child) &&
        conditionSignalsFailure(parent.left.getText(source))
      ) {
        return true;
      }
      if (
        ts.isIfStatement(parent) &&
        contains(parent.thenStatement, child) &&
        conditionSignalsFailure(parent.expression.getText(source))
      ) {
        return true;
      }
    }
    return false;
  }

  function visit(node) {
    if (
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) &&
      isFailureBranch(node)
    ) {
      const renderedSource = node.getText(source);
      if (literalResultCount.test(renderedSource) || dynamicResultCount.test(renderedSource)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push(`${relativePath}:${line}`);
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

/**
 * Direct `var(--text-<step>)` consumers in any production source. The unused-step
 * gate and its exemption anti-rot check must share this predicate — a class-only
 * check lets an exemption survive once a CSS consumer appears.
 *
 * CSS sources are walked declaration-by-declaration so a quoted `content:`
 * string cannot fake a consumer. Non-CSS sources strip comments first, then
 * match `var(--text-*)` in remaining text (covers inline style strings).
 */
export function findTypeStepCssUsagesInSource(sourceText, relativePath = "source.css") {
  const steps = [];
  const record = (step) => {
    if (!step.includes("--") && !step.endsWith("-tr")) steps.push(step);
  };

  if (relativePath.endsWith(".css")) {
    for (const declaration of cssDeclarations(sourceText)) {
      if (declaration.prop.startsWith("--")) continue;
      // Drop CSS string tokens so `content:"var(--text-…)"` cannot count.
      const value = declaration.value.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
      for (const match of value.matchAll(/var\(\s*--text-([a-z0-9-]+)\s*[,)]/g)) {
        record(match[1]);
      }
    }
    return steps;
  }

  const withoutComments = sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const match of withoutComments.matchAll(/var\(\s*--text-([a-z0-9-]+)\s*[,)]/g)) {
    record(match[1]);
  }
  return steps;
}

export function findRawScaleLiteralDeclarationsInSource(sourceText) {
  const analysis = analyzeCssContractsInSource("source.css", sourceText);
  return {
    padding: analysis.rawPaddingLiterals,
    radius: analysis.rawRadiusLiterals,
    gap: analysis.rawGapLiterals,
    margin: analysis.rawMarginLiterals,
    lineHeight: analysis.rawLineHeightLiterals,
  };
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
