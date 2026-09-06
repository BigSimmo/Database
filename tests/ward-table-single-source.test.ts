// tests/ward-table-single-source.test.ts
//
// Ten files under `src/components/ward-management/` used to render `<table>` elements with
// copy-pasted, near-identical CSS — same tokens, same values, differing only in `min-width` and
// rule order. `ward-table/ward-table.module.css` now declares that rule set once; every migrated
// module `composes: table from "../ward-table/ward-table.module.css"` instead of redeclaring it.
//
// This test holds two things: the canonical rule set lives in exactly one file, and no other
// ward module redeclares `.table th`/`.table td` padding or border.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";
const CANONICAL_PATH = join(WARD_DIR, "ward-table", "ward-table.module.css").split("\\").join("/");

/** Recursively lists every file under `dir`. Derived from disk, never a hand-written list — a
 *  hand-picked file set has shipped a red test twice on this project already: it silently stops
 *  covering whatever file somebody adds tomorrow, and the suite keeps passing with one file fewer
 *  inside it. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function wardStylesheets(): string[] {
  return walk(WARD_DIR)
    .filter((file) => file.endsWith(".module.css"))
    .map((file) => file.split("\\").join("/"));
}

/**
 * Comments describing the canonical block quote its selectors in prose — e.g. discharges.module.css
 * says "`.table th` (`ward-table.module.css`) carries `white-space: nowrap`". A naive text search
 * for the literal selector would flag that prose as a redeclaration. Strip comments first, exactly
 * like `tests/ward-composes-targets.test.ts` and `tests/ward-primitives-shared.test.ts` already do
 * for the same reason, so only genuine rules remain.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * Removes every `@media (...) { ... }` block wholesale (nested rule braces and all). Several
 * migrated files legitimately carry a `@media print` override touching `.table th`/`.table td` —
 * e.g. `handover.module.css`'s `.table th, .table td { border-bottom-color: CanvasText; }`, which
 * resets only the print-time COLOUR, never the structural `border-bottom`/`padding` this test
 * guards. That is a scoped, deliberate per-file customisation, not the canonical rule set
 * reappearing, and every sibling file in this migration has an equivalent print block of its own
 * — the thing this test must not flag. `ward-token-layer.test.ts` strips `@media` blocks from the
 * token layer for the identical reason (measuring "the BASE declarations").
 *
 * A regex cannot do this correctly on its own: nested rule blocks inside `@media { ... }` contain
 * their own `}`, so `/@media[^{]*\{[^}]*\}/` would close on the FIRST inner rule's brace, not the
 * media block's own — leaving the rest of the block (and any genuine violation hiding in the next
 * rule) unstripped. This walks brace depth instead.
 */
function stripAtMediaBlocks(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    const braceStart = css.indexOf("{", at);
    if (braceStart === -1) {
      out += css.slice(at);
      break;
    }
    let depth = 1;
    let j = braceStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    i = j;
  }
  return out;
}

/** Comments stripped, then `@media` blocks stripped — order matters: a comment could contain the
 *  literal text "@media" followed by something brace-shaped, so real comments must go first. */
function baseDeclarations(css: string): string {
  return stripAtMediaBlocks(stripComments(css));
}

/**
 * Every `{ ... }` rule block whose selector list contains a `.table` compound descendant selector
 * (`.table th`, `.table td`), on the comment-stripped text. Global (`matchAll`), never `.exec()` —
 * `.exec()` returns only the first match, which is exactly how a real guard in this token layer
 * (`ward-tokens.module.css`) once measured only the light-theme declaration and certified a value
 * that failed its own rule in dark. A file can carry more than one such block (the canonical file
 * itself has the cell-styling block AND the last-child block), so every match must be counted.
 */
function tableCellRuleBlocks(strippedCss: string): string[] {
  const blocks: string[] = [];
  /*
   * THE SELECTOR IS A FAMILY, NOT A LITERAL - WIDENED 2026-09-05 AFTER WARD VERIFIER SHOWED THE
   * LITERAL FORM COULD NOT SEE A REAL REDECLARATION.
   *
   * It matched the literal class `.table` only, so `.capacityTable th`, `.dataTable th` and
   * `.compareTable th` matched nothing and three ward modules sat outside this guard entirely.
   *
   * AND IT MATTERED MOST AT THE MOMENT THE ALLOWLIST WAS EMPTIED. With entries, the assertion
   * read "these files still need migrating". Emptied, it reads "the estate is clean" - and the
   * estate was not clean. It simply did not use that class name. Two different claims, and only
   * the first was ever proved.
   *
   * Verifier proved it with the real rule rather than a synthetic one: `ed/ed.module.css` as
   * shipped yields zero blocks, and renaming only its class to `.table` yields one whose padding
   * is byte-identical to the value pinned as canonical below. The class name was the only thing
   * between that file and this assertion.
   *
   * I THEN PREDICTED THE WIDENING WOULD FLAG EXACTLY ONE FILE, AND IT FLAGGED THREE. I had
   * measured for the canonical padding AND border VALUES; this guard's filter is the looser
   * "declares padding or a border at all". A stricter property than the one the assertion
   * actually tests - which is the same error, one guard over, as every other one tonight.
   * The three are recorded below with their individual reasons rather than hidden behind a
   * value check, because a value check would have restored the silent blind spot.
   */
  for (const match of strippedCss.matchAll(/\.[\w-]*[Tt]able[\w-]*\s+(?:th|td)\b[^{}]*\{([^{}]*)\}/gu)) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Whether any captured rule body actually declares `padding` or a `border` property — the two
 * properties the brief names. A bare selector match without either would not be "the canonical
 * rule set redeclared", so this is checked in addition to, not instead of, the selector match.
 *
 * ⚠️ `border` MUST MATCH `border-bottom`, NOT JUST THE BARE PROPERTY. The canonical rule declares
 * `border-bottom`, never plain `border`. A first draft here required the property name to be
 * followed immediately by a non-word, non-hyphen character before the colon — which matches
 * `padding:` but, because `-` is itself excluded by that class, can never reach the colon in
 * `border-bottom:` at all. It passed anyway, on this file, only because `padding` matches
 * independently in every real block seen so far; a violator that redeclared `border-bottom`
 * alone would have slipped through silently. `[a-z-]*` (a real property-name continuation)
 * replaces it.
 */
function declaresPaddingOrBorder(blocks: string[]): boolean {
  return blocks.some((body) => /\b(padding|border)[a-z-]*\s*:/u.test(body));
}

const STYLESHEETS = wardStylesheets();

describe("the Ward Flow `.table` rule set is declared in exactly one file", () => {
  /**
   * ⚠️ ANTI-VACUITY. Floors the DENOMINATOR: if `walk()` breaks (wrong root, wrong extension
   * filter) it returns fewer and fewer files, and a shrinking population makes every assertion
   * below easier to pass vacuously, not harder. 42 `.module.css` files existed under this root
   * before this task added a 43rd; 15 is a floor well clear of both, not a value chosen to just
   * scrape past today's count.
   */
  it("is actually scanning the Ward Flow stylesheet tree", () => {
    expect(
      STYLESHEETS.length,
      `expected to discover at least 15 ward-management stylesheets, found ${STYLESHEETS.length}`,
    ).toBeGreaterThanOrEqual(15);
  });

  it("finds the canonical file among the ones it walked", () => {
    expect(STYLESHEETS).toContain(CANONICAL_PATH);
  });

  /**
   * ⚠️ PINNED, NOT CAPPED — same pattern `tests/ward-primitives-shared.test.ts` uses for its own
   * pre-existing backlog. `referrals/referrals.module.css` still carries its own copy of this
   * rule set: it is a HARD EXCLUSION for this task (`referral-board.tsx`'s two tables stay on
   * their own CSS this round — Ward Builder Three is editing that file live on
   * `claude/ward-builder-three`; see `task-wardtable-report.md`), not an oversight. A named
   * exception fails on either direction of drift: if referrals is ever migrated, deleting it from
   * this list is required progress, not permission to widen the list; if some OTHER file starts
   * re-declaring the rule, it shows up as an unlisted extra member below and this test goes red.
   */
  /*
   * ⚠️ **EMPTY AS OF 2026-09-05, AND EMPTY IS THE STRONG STATE RATHER THAN THE VACUOUS ONE.**
   * `referrals/referrals.module.css` was the single entry, held out because Ward Builder Three was
   * editing that file live. It composed the shared block in the same session, so the entry was
   * deleted — which this comment's previous wording called "required progress, not permission to
   * widen the list", and that is exactly what happened.
   *
   * With no exceptions the assertion below reads: **exactly one file in the estate declares this
   * rule set.** That is the strongest form this guard has, not a weakened one — an empty allowlist
   * removes places to hide rather than removing coverage. The population it walks is `STYLESHEETS`,
   * which is floored separately above, so an empty list here cannot make the test vacuous.
   *
   * **Re-adding an entry is a decision that needs a reason in this comment**, naming the file, who
   * holds it and why it cannot compose. `ed`, `ward-management-modes` and `ward-management-network`
   * are NOT candidates: their table CSS is not a redeclaration of this block at all — different
   * token layers, border-collapse modes, sticky headers — so they never appear in
   * `filesWithTheRule` and need no exemption.
   */
  /*
   * A STATED BACKLOG, NOT AN EXEMPTION LIST — three entries, three different reasons, because the
   * refusal that put them here was originally given as ONE reason covering all three.
   *
   * When the WardTable implementer declined these modules it said their table CSS "is not a
   * redeclaration of the canonical block". Ward Verifier checked that claim per module, deriving
   * the signature of a redeclaration from an ACCEPTED migration rather than from the claim:
   *
   *   ward-management-modes    STRUCTURAL. `.dataTable th` is `position: sticky`, and a sticky
   *                            header REQUIRES `border-collapse: separate` — collapsed borders do
   *                            not travel with it. The primitive collapses, so migrating this would
   *                            silently lose the sticky header on a six-route component.
   *                            `.candidateTable` is `display: grid`, not a table at all.
   *   ward-management-network  STRUCTURAL for `.compareTable` — borders on all four sides,
   *                            `--text-3xs`, `td[data-tone]` semantics: a matrix, not a
   *                            row-separated list. (Its `.tableScroll` IS a plain duplicate of the
   *                            primitive's wrapper and is queued separately.)
   *   ed                       NOT STRUCTURAL — DEFERRED, NOT CLEARED. Its `.capacityTable th/td`
   *                            carries the canonical padding byte-identically and the same border
   *                            idiom. Every difference is a value or an addition. Whether the
   *                            primitive should grow to absorb it is a design decision nobody has
   *                            taken.
   *
   * WHY THE LIST IS NOT EMPTY, WHICH IS THE POINT. It was emptied when the last migration landed,
   * and an empty list made this assertion read "the estate is clean". The estate was not clean —
   * it simply did not use the class name the detector looked for. Two different claims, and only
   * the first was ever proved.
   *
   * Removing an entry without migrating its file makes the assertion false again. Removing one
   * BECAUSE the file was migrated is what the entry is for.
   */
  const KNOWN_UNMIGRATED: string[] = [
    "src/components/ward-management/ed/ed.module.css",
    "src/components/ward-management/ward-management-modes.module.css",
    "src/components/ward-management/ward-management-network.module.css",
  ];

  it("declares the canonical `.table th`/`.table td` cell rule (padding + border-bottom) in exactly the canonical file plus the known, documented backlog", () => {
    const filesWithTheRule = STYLESHEETS.filter((file) => {
      const blocks = tableCellRuleBlocks(baseDeclarations(readFileSync(file, "utf8")));
      return declaresPaddingOrBorder(blocks);
    });

    expect(
      [...filesWithTheRule].sort(),
      `expected only the canonical file plus the known backlog to declare .table th/.table td padding or border, found: ${filesWithTheRule.join(", ")}`,
    ).toEqual([...[CANONICAL_PATH, ...KNOWN_UNMIGRATED]].sort());
  });

  it("declares the canonical file's rule with the exact padding and border-bottom values", () => {
    const css = baseDeclarations(readFileSync(CANONICAL_PATH, "utf8"));
    const blocks = tableCellRuleBlocks(css);
    expect(blocks.length, `expected at least one .table th/.table td rule block in ${CANONICAL_PATH}`).toBeGreaterThan(
      0,
    );
    const joined = blocks.join("\n");
    expect(joined).toMatch(/border-bottom:\s*0\.0625rem solid var\(--ward-divider\)/u);
    expect(joined).toMatch(/padding:\s*var\(--ward-space-6\)\s*var\(--ward-space-8\)/u);
  });

  /**
   * The other half of the brief's wording: "No other ward module re-declares `.table th` padding
   * or border." Every stylesheet except the canonical one AND the named, documented backlog above
   * must have zero such blocks — this is the assertion that actually fails loudly if a NEW file
   * (not the known referrals exception) starts redeclaring the rule.
   */
  it("no other ward module re-declares .table th/.table td padding or border", () => {
    const offenders = STYLESHEETS.filter((file) => {
      if (file === CANONICAL_PATH || KNOWN_UNMIGRATED.includes(file)) return false;
      const blocks = tableCellRuleBlocks(baseDeclarations(readFileSync(file, "utf8")));
      return declaresPaddingOrBorder(blocks);
    });

    expect(offenders, `these files re-declare the canonical .table cell rule: ${offenders.join(", ")}`).toEqual([]);
  });

  /**
   * The five migrated call sites (`discharges`, `escalation`, `handover`, `out-of-area`, `search`)
   * must actually compose the shared class rather than merely happening to have no local
   * redeclaration (e.g. because the file was deleted or the class renamed without anyone noticing).
   * Named from the brief's own migration list, not re-derived — the population floor above is the
   * anti-vacuity check on discovery; this is a sanity check that the migration actually happened
   * where it was supposed to.
   */
  it("the five migrated call sites compose the shared table class", () => {
    const migrated = [
      join(WARD_DIR, "discharges", "discharges.module.css"),
      join(WARD_DIR, "escalation", "escalation.module.css"),
      join(WARD_DIR, "handover", "handover.module.css"),
      join(WARD_DIR, "out-of-area", "out-of-area.module.css"),
      join(WARD_DIR, "search", "search.module.css"),
    ].map((p) => p.split("\\").join("/"));

    for (const file of migrated) {
      const css = readFileSync(file, "utf8");
      expect(css, `expected ${file} to compose the shared table class from ward-table.module.css`).toMatch(
        /composes:\s*table\s+from\s+"\.\.\/ward-table\/ward-table\.module\.css"\s*;/u,
      );
    }
  });
});
