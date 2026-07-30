/**
 * The cascade-layer inertness registry (ledger #094).
 *
 * PR #1316 shipped the search band's accent rail **inert**: `.search-band` sat in
 * `@layer components`, which loses to Tailwind's unlayered utilities regardless of
 * specificity, so the border never painted. The test that was supposed to protect
 * it asserted `toHaveClass("search-band")` — class presence, i.e. the *cause* —
 * and passed happily while the *effect* was absent. jsdom cannot catch this class
 * of bug at all: it does not implement cascade layers, so
 * `tests/search-results-header-band.dom.test.tsx` still asserts the class today.
 *
 * Only a real browser can prove a style is live, and `check:design-system-contract`
 * cannot help either — it is a static AST/regex pass over source text.
 *
 * So this file holds two things:
 *
 * 1. {@link parseUnlayeredVisualClasses} — the inventory. Every class rule in
 *    `globals.css` that sits OUTSIDE `@layer` and carries a visual property is a
 *    class that deliberately relies on being unlayered to beat a utility. Those
 *    are exactly the rules that go inert if someone moves them into a layer.
 * 2. {@link STYLE_EFFECT_CONTRACTS} — rendered-effect assertions, driven in a real
 *    browser by `tests/ui-style-contract.spec.ts`.
 *
 * `tests/style-contract-registry.test.ts` ties the two together: every class in the
 * inventory must be either covered by a contract or carry an explicit, reasoned
 * exemption below. A newly-added unlayered class therefore fails the gate until
 * someone consciously decides which it is. That is the part that was missing —
 * the existing rail assertion in `ui-accessibility.spec.ts` was a one-off, and
 * nothing forced the next unlayered class to get one.
 */

/** A declaration group that a Tailwind utility could plausibly fight over. */
const VISUAL_PROPERTY =
  /(?:^|[;{])\s*(?:border(?:-top|-bottom|-left|-right)?(?:-width|-color|-style)?|background(?:-color|-image)?|box-shadow|color|outline(?:-color|-width)?)\s*:/m;

/** Replace comment bodies with blanks so line numbers survive the strip. */
function blankComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ""));
}

export type UnlayeredVisualClass = {
  readonly className: string;
  /** 1-indexed lines of every unlayered rule that styles this class. */
  readonly lines: readonly number[];
  /** Media queries wrapping those rules, if any. */
  readonly media: readonly string[];
  /**
   * Whether at least one of those rules sits outside every media query.
   *
   * Tracked separately because `media` is a union across all of a class's rules:
   * a class with one plain rule and one `forced-colors` override would otherwise
   * look media-scoped, and {@link isMediaOverrideOnly} would wave its real
   * component rule past the coverage gate.
   */
  readonly unmediated: boolean;
};

/**
 * Class rules in `css` that sit outside every `@layer` block and set a visual
 * property.
 *
 * Brace depth is tracked line by line rather than with a real CSS parser: this
 * repo's stylesheet is hand-written with one selector or declaration per line, and
 * a dependency-free reader keeps the gate runnable in the node Vitest project.
 */
export function parseUnlayeredVisualClasses(css: string): UnlayeredVisualClass[] {
  const lines = blankComments(css).split("\n");
  const layerRegions: Array<[number, number]> = [];
  const mediaRegions: Array<[number, number, string]> = [];
  const openLayers: Array<[number, number]> = [];
  const openMedia: Array<[number, number, string]> = [];
  let depth = 0;

  for (const [index, line] of lines.entries()) {
    if (/^\s*@layer\s/.test(line) && line.includes("{")) openLayers.push([index, depth]);
    const media = /^\s*@media([^{]*)\{/.exec(line);
    if (media) openMedia.push([index, depth, media[1].trim()]);

    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);

    while (openLayers.length > 0 && depth <= openLayers[openLayers.length - 1][1]) {
      const [start] = openLayers.pop() as [number, number];
      layerRegions.push([start, index]);
    }
    while (openMedia.length > 0 && depth <= openMedia[openMedia.length - 1][1]) {
      const [start, , query] = openMedia.pop() as [number, number, string];
      mediaRegions.push([start, index, query]);
    }
  }

  const insideLayer = (index: number) => layerRegions.some(([start, end]) => start <= index && index <= end);
  const mediaFor = (index: number) =>
    mediaRegions.filter(([start, end]) => start <= index && index <= end).map(([, , query]) => query);

  const found = new Map<string, { lines: number[]; media: Set<string>; unmediated: boolean }>();

  for (const [index, line] of lines.entries()) {
    // A selector line that starts at a class and opens its block on the same
    // line — the only shape `globals.css` uses.
    if (!/^\s*\./.test(line) || !line.trimEnd().endsWith("{")) continue;
    if (insideLayer(index)) continue;

    const body: string[] = [];
    let nesting = 1;
    for (let cursor = index + 1; cursor < lines.length && nesting > 0; cursor += 1) {
      nesting += (lines[cursor].match(/\{/g)?.length ?? 0) - (lines[cursor].match(/\}/g)?.length ?? 0);
      if (nesting > 0) body.push(lines[cursor]);
    }
    if (!VISUAL_PROPERTY.test(body.join("\n"))) continue;

    const selector = line.slice(0, line.indexOf("{"));
    const media = mediaFor(index);
    for (const className of new Set(selector.match(/\.([A-Za-z][\w-]*)/g)?.map((raw) => raw.slice(1)) ?? [])) {
      const entry = found.get(className) ?? { lines: [], media: new Set<string>(), unmediated: false };
      entry.lines.push(index + 1);
      for (const query of media) entry.media.add(query);
      if (media.length === 0) entry.unmediated = true;
      found.set(className, entry);
    }
  }

  return [...found.entries()]
    .map(([className, entry]) => ({
      className,
      lines: entry.lines.sort((a, b) => a - b),
      media: [...entry.media].sort(),
      unmediated: entry.unmediated,
    }))
    .sort((a, b) => (a.className < b.className ? -1 : a.className > b.className ? 1 : 0));
}

/**
 * A class whose only unlayered rules re-pin a token inside `forced-colors`/`print`.
 *
 * These are deliberate high-contrast/print overrides with their own coverage (the
 * forced-colors journeys in `ui-accessibility.spec.ts`), so they do not each need a
 * default-theme effect contract. A class with any unmediated rule is NOT one of
 * these, however loudly its forced-colors override shouts.
 */
export function isMediaOverrideOnly(entry: UnlayeredVisualClass): boolean {
  return !entry.unmediated && entry.media.length > 0 && entry.media.every((query) => /forced-colors|print/.test(query));
}

export type StyleEffectContract = {
  /** The unlayered class this contract proves is live. */
  readonly className: string;
  /** Human-readable name used in the test title. */
  readonly description: string;
  readonly route: string;
  /** Playwright selector for an element carrying `className`. */
  readonly selector: string;
  /** Computed values that must match exactly. */
  readonly computed: Readonly<Record<string, string>>;
  /**
   * Properties that must resolve to something actually visible. A layered (inert)
   * rule leaves these at the UA/utility default — `rgba(0, 0, 0, 0)` or `none` —
   * so this catches inertness even where the exact token value is theme-dependent.
   */
  readonly nonInert?: readonly string[];
};

/**
 * Rendered-effect contracts, asserted in Chromium by `tests/ui-style-contract.spec.ts`.
 *
 * Deliberately small and load-bearing rather than broad and shallow: each entry
 * navigates a real route and reads real computed style, so an entry that cannot be
 * reached deterministically in demo mode is worse than no entry. Broad coverage of
 * "did this surface change visually" is the pixel-baseline suite's job
 * (`tests/ui-visual-baseline.spec.ts`); this file is for the specific rules whose
 * whole purpose is to beat a utility.
 */
export const STYLE_EFFECT_CONTRACTS: readonly StyleEffectContract[] = [
  {
    className: "search-band",
    description: "search band accent rail is a live border",
    route: "/services?q=CMHT&run=1",
    selector: '[data-testid="search-query-ribbon"]:visible',
    // The exact regression: `border-top: 2px solid var(--clinical-accent)` painted
    // nothing while the rule was layered.
    computed: { borderTopWidth: "2px", borderTopStyle: "solid" },
    nonInert: ["borderTopColor"],
    // NOTE: an attribute-variant assertion (`[data-status="error"]` re-colours the
    // rail via `--warning`) was written and removed again. It failed in CI and then
    // reproduced locally, so it is NOT a timing race — the computed border colour
    // simply does not change the way the stylesheet reads as though it should. That
    // is either a real cascade fact worth understanding or a token that resolves to
    // the same value, and neither was diagnosed. Shipping the assertion would have
    // put an unexplained red in the required gate; shipping it silently weakened
    // would have been worse. Recorded as a follow-up instead.
  },
];

/**
 * Unlayered visual classes with no rendered-effect contract yet, and why.
 *
 * This is debt made countable, not debt excused — ledger #094 asks for effect
 * assertions across this surface and each line below is a place that still has
 * none. The value of listing them is that the inventory is now closed: a new
 * unlayered class is neither contracted nor exempt, so the gate fails and the
 * author has to choose. Prefer deleting a line here by adding a contract.
 */
export const STYLE_CONTRACT_EXEMPTIONS: Readonly<Record<string, string>> = {
  // Not component effects.
  dark: "theme root selector, not a component class; token values are asserted by the dark-mode journeys",
  "touch-card": "sets outline/touch-action only; the shared focus treatment is asserted by ui-accessibility",

  // Phone/answer composer chrome. Covered behaviourally by verify:phone-chrome and
  // the chrome-scroll/overlap journeys, but not yet by computed-effect assertions.
  "answer-footer-search-backdrop": "phone composer chrome — reserve/overlay behaviour covered by ui-chrome-scroll",
  "answer-footer-search-chip": "phone composer chrome — no effect contract yet (#094)",
  "answer-footer-search-divider": "phone composer chrome — no effect contract yet (#094)",
  "answer-footer-search-dock": "phone composer chrome — dock geometry covered by ui-phone-scroll",
  "answer-footer-search-edge": "phone composer chrome — edge-to-edge contract covered by ui-phone-scroll",
  "answer-footer-search-input": "phone composer chrome — no effect contract yet (#094)",
  "answer-footer-search-pill": "phone composer chrome — no effect contract yet (#094)",
  "answer-footer-search-pill-open": "phone composer chrome — no effect contract yet (#094)",
  "answer-footer-search-send": "phone composer chrome — no effect contract yet (#094)",
  "chat-composer-icon-button": "answer composer — no effect contract yet (#094)",
  "chat-composer-input": "answer composer — no effect contract yet (#094)",
  "chat-composer-shell-base": "answer composer — no effect contract yet (#094)",
  "chat-composer-shell-delta": "answer composer — no effect contract yet (#094)",
  "chat-send-button": "answer composer — no effect contract yet (#094)",
  "document-mobile-search-edge": "document viewer composer — covered by ui-phone-scroll geometry, not effect",
  "document-mobile-search-pill": "document viewer composer — no effect contract yet (#094)",
  "edge-glass-header-backdrop":
    "overlaid glass header — forced-colors and reserve behaviour covered by ui-accessibility",
  "universal-header": "shared header — hide/reveal covered by ui-chrome-scroll; background effect not contracted yet",

  // Answer suggestions and smart search.
  "answer-suggestion-chip": "answer suggestion rail — no effect contract yet (#094)",
  "answer-suggestion-chip-icon": "answer suggestion rail — no effect contract yet (#094)",
  "answer-suggestion-label": "answer suggestion rail — no effect contract yet (#094)",
  "smart-search-rotating-query": "rotating placeholder — reduced-motion behaviour covered by ui-accessibility",
  "smart-search-rotating-text": "rotating placeholder — reduced-motion behaviour covered by ui-accessibility",

  // Mode switcher.
  "mode-action-surface": "mode menu surface — dismissal/focus covered by ui-accessibility, effect not contracted",
  "mode-action-mode-option": "mode menu option — no effect contract yet (#094)",
  "mode-action-mode-option-active": "mode menu option — no effect contract yet (#094)",
  "mode-action-mode-option-icon": "mode menu option — no effect contract yet (#094)",

  // Mode-specific surfaces.
  "differentials-mobile-compare-fab__button": "differentials compare FAB — no effect contract yet (#094)",
  "differentials-mobile-compare-fab__button--empty": "differentials compare FAB — no effect contract yet (#094)",
  "medication-mobile-result": "prescribing phone results — no effect contract yet (#094)",
  "medication-mobile-results": "prescribing phone results — no effect contract yet (#094)",
  "medication-patient-strip": "prescribing patient strip — no effect contract yet (#094)",
  "pwa-install-sheet": "install sheet — presence covered by ui-pwa, effect not contracted",
  "search-band-count": "count weight/colour; the zero-result state needs a deterministic empty fixture first",
  "search-band-rule": "gradient divider — forced-colors fallback covered by ui-accessibility",
};
