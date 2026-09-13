import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Print-colour coverage guard for every `*.module.css` under `src/components/ward-management/**`.
 *
 * THE DEFECT. Dark mode here is a CSS CLASS (`.dark` on `<html>`, `globals.css:681`), not a media
 * query, so it stays active while printing. Under `.dark`, `--neutral-900` is near-white and
 * `--text` aliases it (as do `--text-heading`, `--text-muted`, and every themed `--ward-*` colour
 * alias declared in `ward-tokens.module.css` — `--ward-heading`, `--ward-muted`, `--ward-danger`,
 * `--ward-warning`, `--ward-success`, `--ward-blue`, all of which resolve through a token that
 * differs between `globals.css`'s light and `.dark` blocks). A colour declared on an element
 * cannot be overridden by ANY ancestor rule at any specificity, so a rule declaring one of these
 * themed colours keeps printing near-white ink on white paper unless ITS OWN `@media print`
 * reaches it — a containing screen's own reset is not enough.
 *
 * ── PART A vs PART B ─────────────────────────────────────────────────────────────────────────
 * This file only checks coverage; it does not decide which selector convention a fix uses. Two
 * conventions are both accepted, self-detected from the stylesheet text, no per-file config
 * needed beyond `KNOWN_UNFIXED` below:
 *
 *   1. ROOT-WILDCARD. A print rule whose selector list includes a literal `.someClass *` entry
 *      (a class immediately followed by the universal selector) is treated as a UNIVERSAL reset
 *      for the whole file: every themed-colour declaration anywhere in the file is checked
 *      against it, regardless of whether that declaring selector's text mentions the root class
 *      at all. This is a domain assumption, carried over unchanged from this guard's first
 *      version: within a single-root component, everything the file declares is assumed (by the
 *      convention the fix follows, not by anything derivable from the CSS text alone) to render
 *      as a descendant of that root. A file may declare more than one such root (`ward-sidebar.
 *      module.css` has three — the same content mounts in three different DOM locations) and
 *      each one contributes its own universal reset.
 *   2. ENUMERATION. Any OTHER selector inside an `@media print` rule that sets
 *      `color: CanvasText` is a TARGETED reset, and covers ONLY a declaring rule whose selector
 *      text is byte-for-byte identical to it. This is what makes enumeration a real commitment
 *      rather than a loophole: add a new state variant to `ward-chip.module.css` without adding
 *      its selector to the print block, and this guard fails on that exact selector — it is
 *      never covered by someone else's `.foo *` elsewhere in the same file.
 *
 * Either way `!important` (or matching/exceeding specificity — the same comparator as before)
 * is what makes a reset actually WIN, not merely exist. See "the specificity comparator itself"
 * describe block below, unchanged from this guard's first version, for why a plain `.screen *`
 * reset is not sufficient on its own: `.table td` (specificity 0,1,1) outranks `.screen *`
 * (specificity 0,1,0), and specificity is decided before source order.
 *
 * ── PART C: `composes` IS NOT AN ANCESTOR (2026-09-04) ──────────────────────────────────────
 * `ward-tokens.module.css` now carries the print reset centrally: `@media print { .wardTokens,
 * .wardTokens * { color: CanvasText !important; ... } }`. A stylesheet whose root class does
 * `composes: wardTokens from "../ward-tokens.module.css"` gets BOTH class names compiled onto the
 * SAME element — this is CSS Modules composition, not CSS inheritance — so that reset lands on
 * the very element it names, and (via `.wardTokens *`) on every descendant too. Parts A and B
 * above already covered a file's OWN `@media print` rules; this part is about resolving a
 * `composes:` line to a (stylesheet, class) pair and asking whether THAT class carries a winning
 * reset — never merely "does this file compose something."
 *
 * A `composes:` declaration is resolved to an EDGE: {composing file, composing selector, composed
 * class name, target file}. The target file's `@media print` rules are then indexed by class name
 * into two buckets — BARE (`.className { color: CanvasText ... }`, no wildcard) and WILDCARD
 * (`.className * { ... }`) — using the exact same selector-shape distinction Part A already draws
 * for local resets, just keyed by class name instead of full selector text (a composed class can
 * be attached to any selector in the composing file, so the composing file's own selector text is
 * never compared against the target's).
 *
 * COVERAGE SEMANTICS, on purpose asymmetric between ROOT and NON-ROOT:
 *
 *   ROOT composes reaching a WILDCARD target reset that wins
 *       -> blanket coverage of the WHOLE composing file. This is the same single-root domain
 *          assumption Part A's WILDCARD_RESET_SELECTOR rule already makes for a file's own
 *          `.class *` reset ("everything the file declares is assumed to render as a descendant
 *          of the root") — composing the reset in from elsewhere doesn't weaken that assumption,
 *          it just changes where the reset text lives. For the seven files this rewrite moves out
 *          of KNOWN_UNFIXED below, DOM containment was verified the same way Part A's assumption
 *          always has been: by reading the JSX and grepping the whole ward-management tree for
 *          `createPortal` (none found).
 *   ROOT composes reaching only a BARE target reset (no wildcard variant)
 *       -> covers only the composing selector's own declaration (bare `color` does not defeat a
 *          descendant's own declared `color` — only a `.class *` shape does), same as non-root.
 *   NON-ROOT composes reaching a winning reset (bare or wildcard)
 *       -> covers ONLY that element (an exact match against a declaring selector of the identical
 *          text, the same convention Part A's ENUMERATION rule already uses within one file) —
 *          NEVER the rest of the file. `ed-home.module.css` composes FOUR times: `.screen`
 *          (line 14, ROOT — the file's only wardTokens edge, in its first rule) reaches
 *          `wardTokens`'s wildcard reset and blanket-covers the file; `.populationNote` (line 83)
 *          composes `hint`, which `ward-shared.module.css` DOES reset (bare, exact) — covered, but
 *          scoped to `.populationNote` alone; `.heroBody` (line 90, composes `hero`) and
 *          `.heroFiguresGrid` (line 101, composes `heroFigures`) compose classes `ward-shared`
 *          does NOT reset at all — these two edges resolve to no coverage and contribute nothing.
 *          None of this matters to ed-home's own `declaring` list in practice (only the ROOT edge
 *          does — `.populationNote`/`.heroBody`/`.heroFiguresGrid` never declare a themed colour
 *          locally themselves), which is exactly why Mutation C below (deleting ONLY the root
 *          edge, leaving the other three composes lines intact) still turns the guard red.
 *
 *   WHAT COUNTS AS "ROOT". Never the class name (`wardTokens` is not special-cased — that is
 *   exactly the shape of trap this codebase has already been caught by twice: a class name and a
 *   token alias each defeated a name-matching detector once). A composes edge is ROOT-level iff
 *   BOTH: (a) its composing selector is the file's FIRST class-declaring rule (source order, among
 *   top-level, non-print rules), AND (b) it is the ONLY edge in the file composing that exact
 *   (class name, target file) pair. Condition (b) is the guard against a multi-root file:
 *   `ward-management.module.css` composes `wardTokens` TWICE — once on `.patientWorkspace` (its
 *   first rule) and again, separately, on `.clinicalRail` — so neither is unique, and BOTH resolve
 *   as non-root (scoped to their own selector only), even though `.patientWorkspace` would pass
 *   condition (a) alone. That file's DOM containment under a single root was never verified the
 *   way the seven target files' was, so this guard does not grant it the blanket leap — its
 *   `.rowName`/`.rowNote` composes edges (lines 781/786, composing `wardName`/`hint` from
 *   `ward-shared.module.css`) resolve covered, narrowly, and its other ~60 declaring selectors are
 *   covered only by its own pre-existing local `.patientWorkspace, .patientWorkspace *` print
 *   block — a separate mechanism this task does not touch.
 *
 * ── WHY THIS FILE NOW WALKS DISK INSTEAD OF A HARDCODED LIST ────────────────────────────────
 * The first version of this guard hardcoded eight stylesheet paths. A later session ran it
 * against their own tree, saw none of their own files named in the output, and was one sentence
 * from concluding their files were clean. They were not — they simply were not walked. Absence
 * from a guard's output is not evidence when the guard does not walk the file. `discoverStylesheets`
 * below recurses the real directory tree every run, so a new stylesheet is checked the moment it
 * exists, with no second step to remember.
 *
 * Not every discovered file is fixed yet — most are owned by other sessions and are mid-repair.
 * `KNOWN_UNFIXED` is the explicit, TWO-SIDED record of that: `unexpectedlyBroken` catches a file
 * that should be clean and is not (a regression, or a new file nobody added to the amnesty list
 * on purpose); `fixedButStillListed` catches a `KNOWN_UNFIXED` entry that is now clean and MUST
 * be deleted from the list — the half that makes the amnesty list shrink as other sessions land
 * their fixes, instead of rotting into a permanent exemption nobody revisits. A third check
 * confirms every `KNOWN_UNFIXED` path still exists on disk, so a renamed or deleted file cannot
 * leave a stale entry granting amnesty to nothing.
 *
 * REQUIREMENTS THIS GUARD MEETS (each has already produced a wrong answer in this codebase before):
 *   1. Comments are stripped before any scan — these files carry long prose comments that
 *      literally discuss `color`, `print` and `.screen` in English sentences.
 *   2. Rules are found by brace-depth parsing, tracking which are nested inside `@media print`
 *      versus outside it — a rule means the opposite thing on each side of that boundary.
 *   3. The anti-vacuity floor is on the exact collections the assertions below read: the
 *      discovered-file count (walk correctness) and the total themed-colour-declaration count
 *      across all of them (regex correctness) — not on some larger population the assertions
 *      never consume.
 *   4. Mutation-proved: see the record below.
 *
 * ── MUTATION RECORD (2026-09-04) ────────────────────────────────────────────────────────────
 * Proof 1 (the widened walk works): `ward-figure.module.css`'s `@media print { .figure, .figure *
 * { color: CanvasText !important; } }` block was temporarily deleted in full, confirmed different
 * from the committed file by `git diff`, and the targeted run below went RED in
 * `unexpectedlyBroken` naming `src/components/ward-management/ward-figure.module.css` (with all
 * four of its themed-colour selectors — `.figureLabel`, `.figureUnit`, `.figureSub`,
 * `.figure[data-flagged="true"] .figureValue`). The file was then restored to the exact original
 * text (not via `git checkout --`), and `git hash-object` matched `git rev-parse HEAD:<path>` —
 * both hashes are quoted in the task report.
 *
 * Proof 2 (the shrink half works): `discharges.module.css` (already fully covered, per the
 * original eight-screen fix) was temporarily added to `KNOWN_UNFIXED` below with a fabricated
 * note, confirmed different from the committed file by `git diff`, and the targeted run below
 * went RED in `fixedButStillListed` naming exactly that path. `KNOWN_UNFIXED` was then restored to
 * its exact original text and `git hash-object` matched `git rev-parse HEAD:<path>` — both hashes
 * are quoted in the task report.
 *
 * Proofs 3–5, added for the `composes` resolver (Part C above), each restored by committed blob
 * (never by reverse-replacement) with matching `git hash-object`/`git rev-parse HEAD:<path>`
 * hashes quoted in the task report:
 *   Mutation A (invents-safety direction): confirmed `ward-management-network.module.css`'s
 *   `descendantKill` edge resolves NOT covered by composition, then the resolver was temporarily
 *   broken to treat any `composes:` as covering without resolving the target — the negative
 *   control assertion went RED — then restored.
 *   Mutation B (loses-safety direction): `handover/handover.module.css`'s `composes: wardTokens`
 *   line was deleted; the guard went RED naming that file; restored from `git show HEAD:<path>`.
 *   Mutation C (the file that composes both kinds): `ed/ed-home.module.css`'s ROOT `composes:
 *   wardTokens` line (only) was deleted, leaving its three non-root composes lines intact; the
 *   guard still went RED naming `ed-home.module.css`'s seven declaring selectors, because none of
 *   those non-root edges reach them; restored from `git show HEAD:<path>`.
 *
 * WHY NOT A DOM/JSDOM CHECK. This file is `*.test.ts`, collected by this repo's "node" Vitest
 * project (`vitest.config.ts`); only `*.dom.test.tsx` gets a `document`. A literal
 * `getComputedStyle` proof was considered and rejected as impractical for this filename rather
 * than skipped — the specificity comparator is the "plain computed-specificity assertion"
 * alternative, applied to the selectors these files actually declare.
 */

/** Every `*.module.css` under this directory, recursively, sorted for stable output. Nothing here
 *  is a hardcoded list of filenames — that is the exact gap this rewrite closes. */
const COMPONENT_ROOT = "src/components/ward-management";

/**
 * ⚠️ TWO-SIDED, BY DESIGN. An entry here is not a clean bill of health — it is a note that this
 * FILE still has themed-colour declarations with no `@media print` reset winning over them
 * (whether written locally or reached through `composes:`), and that fixing it belongs to
 * whichever session owns it, not to this one (this session's mandate was exactly five
 * primitives: `ward-chip`, `ward-panel`, `ward-figure`, `ward-sidebar`, `ward-shell` — all five
 * are fixed and none appear below).
 *
 * Measured 2026-09-04 by running this file's own `discoverStylesheets` + `analyze` (now
 * `composes:`-aware — see Part C of the file doc comment above) against the tree at HEAD, then
 * listing every result with `uncovered.length > 0`. Ten entries left this map in the same sweep
 * that taught the guard to resolve `composes:`: seven (`community-home`, `community-team-hub`,
 * `community-teams-table`, `ed-home`, `ed-service-bands`, `handover`, `morning`) are now covered
 * because their root class composes `wardTokens`, which now carries the central print reset; the
 * other three (`morning-tour`, `override-register`, `ward-shared`) were fixed directly by their
 * own print blocks in the same window and never needed `composes:` at all. This list is EXPECTED
 * TO SHRINK further: as another session adds its own `@media print` coverage, `fixedButStillListed`
 * below will fail on that file's entry until it is deleted from this map. Do not add an entry
 * "just in case" — an entry for a file that is actually covered fails the guard immediately.
 */
const KNOWN_UNFIXED: Record<string, string> = {
  "src/components/ward-management/wards/ward-overview.module.css":
    "no importer in the repo — this stylesheet renders nowhere; retention is an owner decision, " +
    "not a defect. Fixing it would be work on a file nothing mounts.",
};

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/** Recursively lists every `*.module.css` under `root` (a path relative to the repo root),
 *  returning paths relative to the repo root with forward slashes, sorted. This is the walk that
 *  replaces the hardcoded `STYLESHEETS` list the first version of this guard carried. */
function discoverStylesheets(root: string): string[] {
  const absRoot = resolve(process.cwd(), root);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".module.css")) {
        found.push(relative(process.cwd(), abs).split("\\").join("/"));
      }
    }
  };
  walk(absRoot);
  return found.sort();
}

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE ANY SCAN. These files carry long prose comments that discuss
 * `color: var(--text)`, root selectors and `print` in plain English — a matcher that reads
 * comments would report a fixed file as still declaring the defect, or an unfixed one as covered.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

interface Rule {
  /** Trimmed selector list, one entry per comma-separated selector. */
  selectors: string[];
  body: string;
  /** True only when this rule's nearest `@media` ancestor is `@media print`. */
  insidePrintMedia: boolean;
}

/**
 * Single-pass brace-depth parse of a whole (comment-stripped) stylesheet into its rules, each
 * tagged with whether it sits inside `@media print`. This is what distinguishes the two files'
 * worth of near-identical text a flat regex cannot: `.screen { color: CanvasText }` means the
 * opposite thing depending on which side of `@media print {` it falls on.
 *
 * At-rule containers (`@media ...`, and anything else starting `@`) are pushed onto a stack and
 * popped on their closing brace. A plain rule (selector list, no leading `@`) is consumed
 * atomically by depth-counting to its own matching close brace — these files never nest a rule
 * inside another rule, only inside at-rules — and recorded with the stack's current print-media
 * membership.
 */
function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const stack: Array<"media-print" | "other-at"> = [];
  let pos = 0;
  while (pos < css.length) {
    const openIdx = css.indexOf("{", pos);
    const closeIdx = css.indexOf("}", pos);
    if (openIdx === -1 && closeIdx === -1) break;
    if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
      // A bare close brace at this scan level can only be closing an at-rule container: a plain
      // rule's own close brace is consumed atomically below and never seen by this branch.
      stack.pop();
      pos = closeIdx + 1;
      continue;
    }
    const header = css.slice(pos, openIdx).trim();
    if (header.startsWith("@")) {
      const isPrintMedia = /^@media\b/iu.test(header) && /\bprint\b/iu.test(header);
      stack.push(isPrintMedia ? "media-print" : "other-at");
      pos = openIdx + 1;
      continue;
    }
    let depth = 1;
    let j = openIdx + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    const body = css.slice(openIdx + 1, j - 1);
    if (header.length > 0) {
      rules.push({
        selectors: header
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        body,
        insidePrintMedia: stack.includes("media-print"),
      });
    }
    pos = j;
  }
  return rules;
}

/** `path` -> its comment-stripped rules, parsed once. Both `analyze` and the `composes:` resolver
 *  (Part C) need every discovered file's rules — the resolver to find a target class's print
 *  reset, `analyze` for the file's own declaring/reset rules — and a composed target is very often
 *  ALSO one of the files `analyze` walks directly (`ward-tokens.module.css` itself is discovered
 *  by `discoverStylesheets`), so this cache is what stops the tree being parsed twice. */
const parsedFileCache = new Map<string, Rule[]>();
function parseFile(path: string): Rule[] {
  const cached = parsedFileCache.get(path);
  if (cached) return cached;
  const rules = parseRules(stripComments(source(path)));
  parsedFileCache.set(path, rules);
  return rules;
}

/** [id, class-like (class/attribute/pseudo-class), type (element/pseudo-element)]. A simplified
 *  but spec-consistent CSS specificity tuple — simplified because these files' selectors never
 *  combine more than one level of `:not()` nesting or use attribute-value quoting that would
 *  defeat the bracket-matching below, so the simplification does not change any real answer in
 *  this repository; proven non-vacuous against the exact pair that motivated it, below. */
type Specificity = readonly [id: number, cls: number, type: number];

function specificity(rawSelector: string): Specificity {
  let sel = rawSelector.trim();
  let id = 0;
  let cls = 0;
  let type = 0;

  // Attribute selectors, e.g. [data-outside-catchment="true"] — class-level.
  sel = sel.replace(/\[[^\]]*\]/gu, () => {
    cls += 1;
    return " ";
  });

  // :not(...) contributes the specificity of its argument, not itself (CSS Selectors L3/4).
  sel = sel.replace(/:not\(([^)]*)\)/giu, (_match, inner: string) => {
    const [innerId, innerCls, innerType] = specificity(inner);
    id += innerId;
    cls += innerCls;
    type += innerType;
    return " ";
  });

  // Pseudo-elements count as a type selector.
  sel = sel.replace(/::?(before|after|first-line|first-letter|placeholder|marker)\b/giu, () => {
    type += 1;
    return " ";
  });

  // Every remaining pseudo-class is class-level.
  sel = sel.replace(/:[a-zA-Z-]+(\([^)]*\))?/gu, () => {
    cls += 1;
    return " ";
  });

  // IDs.
  sel = sel.replace(/#[a-zA-Z0-9_-]+/gu, () => {
    id += 1;
    return " ";
  });

  // Classes.
  sel = sel.replace(/\.[a-zA-Z0-9_-]+/gu, () => {
    cls += 1;
    return " ";
  });

  // Whatever survives is element type names; the universal selector `*` matches nothing here and
  // correctly contributes 0.
  const typeMatches = sel.match(/[a-zA-Z][a-zA-Z0-9-]*/gu) ?? [];
  type += typeMatches.length;

  return [id, cls, type];
}

/** True when `a` is at least as specific as `b`, comparing id, then class, then type — the same
 *  left-to-right tie-break the CSS cascade uses. */
function specificityGte(a: Specificity, b: Specificity): boolean {
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] >= b[2];
}

/** The property this whole guard exists to check: does a print reset actually beat a declaring
 *  rule on paper? Either the reset carries `!important` (which wins regardless of specificity),
 *  or its own specificity is at least as high as the rule it must override. */
function resetWins(reset: { specificity: Specificity; important: boolean }, declaring: Specificity): boolean {
  return reset.important || specificityGte(reset.specificity, declaring);
}

describe("the specificity comparator itself, proven against the scenario that motivated it", () => {
  /**
   * The first draft of the fix this guard covers added a plain (non-`!important`)
   * `.screen * { color: CanvasText }` reset. It looked like coverage — the selector IS a
   * descendant of `.screen` — but `.table td` (class + type = 0,1,1) outranks `.screen *`
   * (class + universal = 0,1,0) on specificity, decided before source order, so the table cell
   * would still have printed near-white. If the assertions below ever stop reproducing that
   * exact relationship, the comparator has drifted and nothing downstream can be trusted.
   */
  it("computes .table td as more specific than .screen *", () => {
    expect(specificity(".table td")).toEqual([0, 1, 1]);
    expect(specificity(".screen *")).toEqual([0, 1, 0]);
    expect(
      specificityGte(specificity(".screen *"), specificity(".table td")),
      "control: a plain `.screen *` must NOT appear to out-specify `.table td` — if this is true " +
        "the comparator itself is broken and every assertion below is unreliable",
    ).toBe(false);
  });

  it("resetWins requires !important when specificity alone would lose, and correctly says so both ways", () => {
    const losingReset = { specificity: specificity(".screen *"), important: false };
    const winningReset = { specificity: specificity(".screen *"), important: true };
    const declaring = specificity(".table td");

    expect(
      resetWins(losingReset, declaring),
      "control: without !important and with lower specificity, resetWins must report a loss",
    ).toBe(false);
    expect(resetWins(winningReset, declaring), "!important must make the same lower-specificity reset win").toBe(true);
  });

  it("equal or higher specificity wins even without !important", () => {
    expect(resetWins({ specificity: [0, 1, 1], important: false }, [0, 1, 1])).toBe(true);
    expect(resetWins({ specificity: [0, 2, 0], important: false }, [0, 1, 1])).toBe(true);
    expect(resetWins({ specificity: [0, 1, 0], important: false }, [0, 1, 1])).toBe(false);
  });
});

/** Matches a declaration of `color:` whose value is `var(--text)`, `var(--text-heading)`,
 *  `var(--text-muted)`, or any `var(--ward-<name>)` alias — the exact set Part A of this guard's
 *  brief names as "a themed text colour". The `(?:^|;)` anchor is what keeps this from matching
 *  inside `border-color:`/`background-color:` (there is no `;` or body-start immediately before
 *  "color:" in "border-color:"), and the trailing `\)` in each alternative is what stops the
 *  `text` branch from partially matching inside `text-heading`/`text-muted` — the engine only
 *  accepts `text` there if the very next character is `)`. */
const THEMED_COLOR =
  /(?:^|;)\s*color\s*:\s*var\(--(?:text|text-heading|text-muted|ward-[a-zA-Z0-9-]+)\)\s*(?:!important)?\s*;/u;

/** Matches a print-reset declaration of exactly `color: CanvasText`, with or without
 *  `!important` — the fix's target value. Same body-anchoring as `THEMED_COLOR` above, for the
 *  same reason. */
const CANVASTEXT_COLOR = /(?:^|;)\s*color\s*:\s*CanvasText\s*(?:!important)?\s*;/iu;

/** A selector of the exact shape `.someClass *` — a class immediately followed by (only) the
 *  universal selector. This is the marker this guard uses to detect the ROOT-WILDCARD convention
 *  (see the file-level doc comment): a print rule using a selector of this shape is treated as
 *  covering every themed-colour declaration in the file, not merely ones whose text mentions the
 *  root class. */
const WILDCARD_RESET_SELECTOR = /^\.[a-zA-Z][\w-]*\s+\*$/u;

/** A selector of the exact shape `.someClass` — a single class, nothing else. Used by the
 *  `composes:` resolver (Part C) to pull the bare class name back out of a wildcard/bare print
 *  reset selector, so a resolved edge can be looked up "does THIS class have a reset" regardless
 *  of which selector text the composing file happens to use. */
const BARE_CLASS_SELECTOR = /^\.([a-zA-Z][\w-]*)$/u;
const WILDCARD_CLASS_SELECTOR = /^\.([a-zA-Z][\w-]*)\s+\*$/u;

interface ResetCandidate {
  specificity: Specificity;
  important: boolean;
}

interface TargetedReset extends ResetCandidate {
  selector: string;
}

/** Every `@media print` rule in `rules` whose body sets `color: CanvasText` — shared by `analyze`
 *  (a file's own resets) and `classResetIndex` below (a `composes:` target's resets), so the two
 *  never disagree about what counts as a print reset. */
function printResetRules(rules: Rule[]): Rule[] {
  return rules.filter((r) => r.insidePrintMedia).filter((r) => CANVASTEXT_COLOR.test(`${r.body};`));
}

/**
 * A target file's print resets, indexed by the bare class name each selector names — `bare` for
 * `.className { ... }`, `wildcard` for `.className * { ... }`. This is how the `composes:`
 * resolver answers Task 1's ruling ("resolve to a specific (stylesheet, class name) pair, then ask
 * whether THAT class carries a print reset that wins") without ever comparing selector TEXT across
 * files — a composed class can be attached to any selector in the composing file, so only the
 * class name is meaningful cross-file, never the full selector.
 */
interface ClassResetIndex {
  bare: Map<string, ResetCandidate[]>;
  wildcard: Map<string, ResetCandidate[]>;
}
function classResetIndex(path: string): ClassResetIndex {
  const bare = new Map<string, ResetCandidate[]>();
  const wildcard = new Map<string, ResetCandidate[]>();
  for (const rule of printResetRules(parseFile(path))) {
    const important = /color\s*:\s*CanvasText\s*!important/iu.test(rule.body);
    for (const selector of rule.selectors) {
      const wildcardMatch = WILDCARD_CLASS_SELECTOR.exec(selector);
      const bareMatch = BARE_CLASS_SELECTOR.exec(selector);
      const candidate: ResetCandidate = { specificity: specificity(selector), important };
      if (wildcardMatch) {
        const bucket = wildcard.get(wildcardMatch[1]) ?? [];
        bucket.push(candidate);
        wildcard.set(wildcardMatch[1], bucket);
      } else if (bareMatch) {
        const bucket = bare.get(bareMatch[1]) ?? [];
        bucket.push(candidate);
        bare.set(bareMatch[1], bucket);
      }
      // Any other shape (a compound selector inside a print block, e.g. `.crossLink a`) can never
      // be what a *different* file's `composes:` line reaches — composing a class only ever
      // attaches that one class name to an element, never a whole compound selector — so it is
      // simply not indexable here and is correctly ignored.
    }
  }
  return { bare, wildcard };
}

/** One `composes: <class[, more classes]> from "<path>"` declaration, expanded to one edge per
 *  (composing selector × composed class name) pair. `fromSelector` is the FULL selector text of
 *  the rule the `composes:` line sits in — e.g. `.screen` for `ed-home.module.css`'s root edge. */
interface ComposesEdge {
  fromFile: string;
  fromSelector: string;
  className: string;
  targetFile: string;
}

/** Resolves a `composes:`'s `from "<relative path>"` clause to a repo-relative, forward-slashed
 *  path — relative to the COMPOSING file's own directory, the same way the underlying CSS Modules
 *  loader resolves it, never relative to the repo root. */
function resolveComposesTarget(fromFile: string, rawTarget: string): string {
  const fromDir = dirname(resolve(process.cwd(), fromFile));
  const targetAbs = resolve(fromDir, rawTarget);
  return relative(process.cwd(), targetAbs).split("\\").join("/");
}

/** Matches a `composes: <name> [<name> ...] from "<path>";` declaration inside a rule body. A
 *  bare `composes: chip;` (no `from` clause, same-file reference) does not match — same-file
 *  composition never crosses a file boundary, so it is out of scope for this resolver. Declared as
 *  a factory (not a module-level constant) because it carries the global flag and is driven with
 *  `.exec()` in a loop — a shared stateful regex is exactly the kind of trap that produces a
 *  correct-looking answer that depends on call order. */
function composesDeclarationRegex(): RegExp {
  return /composes\s*:\s*([^;]+?)\s+from\s+["']([^"']+)["']\s*;?/gu;
}

/** Every `composes: ... from ...` edge declared in `path`, in source order. Composes declarations
 *  inside `@media print` are impossible in real CSS Modules output and are excluded the same way
 *  `analyze`'s own `declaring` scan excludes print-media rules. */
function composesEdgesFor(path: string): ComposesEdge[] {
  const edges: ComposesEdge[] = [];
  for (const rule of parseFile(path)) {
    if (rule.insidePrintMedia) continue;
    const re = composesDeclarationRegex();
    let match: RegExpExecArray | null;
    while ((match = re.exec(rule.body))) {
      const classNames = match[1]
        .trim()
        .split(/\s+/u)
        .filter((s) => s.length > 0);
      const targetFile = resolveComposesTarget(path, match[2]);
      for (const selector of rule.selectors) {
        for (const className of classNames) {
          edges.push({ fromFile: path, fromSelector: selector, className, targetFile });
        }
      }
    }
  }
  return edges;
}

/** The selector of the FIRST class-declaring, non-print rule in `path`, in source order — half of
 *  this guard's definition of "ROOT" for a `composes:` edge (see Part C of the file doc comment).
 *  `undefined` for a file with no such rule (none of the discovered files, but a safe default). */
function firstRuleSelector(path: string): string | undefined {
  const first = parseFile(path).find((r) => !r.insidePrintMedia);
  return first?.selectors[0];
}

/** A resolved `composes:` edge: WHERE it composes from (`ComposesEdge`), whether it counts as
 *  ROOT (see Part C — never the class name, only file-structural facts: first rule, and unique
 *  per (class, target) pair within the composing file), and what the target file's print-reset
 *  index found for that class, split by shape because the two shapes cover different amounts (a
 *  bare reset covers only the element itself; a wildcard reset also covers its descendants). */
interface ComposesResolution extends ComposesEdge {
  isRoot: boolean;
  wildcardCandidate: ResetCandidate | undefined;
  bareCandidate: ResetCandidate | undefined;
  /** Does this edge, on its own, carry a winning reset for its OWN composing selector? Prefers
   *  the wildcard candidate (it also implies the bare case) and falls back to the bare one. This
   *  is the Task 1 question verbatim — "does THAT class carry a print reset that wins" — asked
   *  against the specificity of the element the class is actually attached to. */
  coveredByComposition: boolean;
}

function resolveComposesEdge(edge: ComposesEdge, siblingEdges: ComposesEdge[]): ComposesResolution {
  const index = classResetIndex(edge.targetFile);
  const pickBest = (candidates: ResetCandidate[] | undefined): ResetCandidate | undefined =>
    candidates === undefined ? undefined : (candidates.find((c) => c.important) ?? candidates[0]);
  const wildcardCandidate = pickBest(index.wildcard.get(edge.className));
  const bareCandidate = pickBest(index.bare.get(edge.className));

  const isUniquePair =
    siblingEdges.filter((e) => e.className === edge.className && e.targetFile === edge.targetFile).length === 1;
  const isFirstRule = edge.fromSelector === firstRuleSelector(edge.fromFile);

  const ownSpecificity = specificity(edge.fromSelector);
  const coveredByComposition =
    (wildcardCandidate !== undefined && resetWins(wildcardCandidate, ownSpecificity)) ||
    (bareCandidate !== undefined && resetWins(bareCandidate, ownSpecificity));

  return {
    ...edge,
    isRoot: isUniquePair && isFirstRule,
    wildcardCandidate,
    bareCandidate,
    coveredByComposition,
  };
}

/** Every `composes:` edge across every discovered file, resolved. This is the population Task 3's
 *  anti-vacuity floor counts — the number of edges the resolver RESOLVED (attempted to look up),
 *  never the number it happened to find covered, so a resolver that gives up and resolves nothing
 *  cannot satisfy the floor by reporting zero coverage on zero edges. */
function allComposesResolutions(files: string[]): ComposesResolution[] {
  const resolutions: ComposesResolution[] = [];
  for (const file of files) {
    const edges = composesEdgesFor(file);
    for (const edge of edges) {
      resolutions.push(resolveComposesEdge(edge, edges));
    }
  }
  return resolutions;
}

interface FileAnalysis {
  path: string;
  /** One entry per top-level (non-print) selector that declares a themed colour. */
  declaring: Array<{ selector: string; specificity: Specificity }>;
  /** `.someClass *`-shaped print resets, local or (Part C) reached via a ROOT `composes:` edge:
   *  apply to every declaring rule in the file. */
  universalResets: ResetCandidate[];
  /** Every other print `color: CanvasText` selector, local or (Part C) reached via a NON-ROOT (or
   *  bare-only) `composes:` edge: applies only to an exact text match. */
  targetedResets: TargetedReset[];
  /** Declaring selectors that neither a universal nor a matching targeted reset wins over. */
  uncovered: string[];
}

function analyze(path: string, composesResolutions: ComposesResolution[]): FileAnalysis {
  const rules = parseFile(path);

  const declaring = rules
    .filter((r) => !r.insidePrintMedia)
    .filter((r) => THEMED_COLOR.test(`${r.body};`))
    .flatMap((r) => r.selectors.map((selector) => ({ selector, specificity: specificity(selector) })));

  const universalResets: ResetCandidate[] = [];
  const targetedResets: TargetedReset[] = [];
  for (const rule of printResetRules(rules)) {
    const important = /color\s*:\s*CanvasText\s*!important/iu.test(rule.body);
    for (const selector of rule.selectors) {
      const candidate: ResetCandidate = { specificity: specificity(selector), important };
      if (WILDCARD_RESET_SELECTOR.test(selector)) {
        universalResets.push(candidate);
      } else {
        targetedResets.push({ selector, ...candidate });
      }
    }
  }

  // Part C: fold in whatever this file's own `composes:` edges resolved to. A ROOT edge reaching a
  // WILDCARD target reset blankets the whole file, same as a local `.class *` reset would — pushed
  // into the SAME `universalResets` array so the coverage comparison below treats it identically.
  // Every other resolved edge (non-root, or root-but-bare-only) covers only its own composing
  // selector — pushed into `targetedResets`, scoped by that selector's exact text, same as this
  // guard's existing same-file ENUMERATION convention already works.
  for (const resolution of composesResolutions) {
    if (resolution.fromFile !== path) continue;
    if (resolution.isRoot && resolution.wildcardCandidate) {
      universalResets.push(resolution.wildcardCandidate);
    } else if (resolution.wildcardCandidate) {
      targetedResets.push({ selector: resolution.fromSelector, ...resolution.wildcardCandidate });
    } else if (resolution.bareCandidate) {
      targetedResets.push({ selector: resolution.fromSelector, ...resolution.bareCandidate });
    }
    // else: the target file carries no matching reset at all for this class — the edge resolved,
    // and contributed nothing (Task 2's negative control is exactly this branch).
  }

  const uncovered = declaring
    .filter((d) => {
      const coveredByUniversal = universalResets.some((u) => resetWins(u, d.specificity));
      const coveredByTargeted = targetedResets.some((t) => t.selector === d.selector && resetWins(t, d.specificity));
      return !coveredByUniversal && !coveredByTargeted;
    })
    .map((d) => d.selector);

  return { path, declaring, universalResets, targetedResets, uncovered };
}

describe("ward-management stylesheets: themed text colour cannot survive un-inked into print", () => {
  const files = discoverStylesheets(COMPONENT_ROOT);

  /**
   * ⚠️ THE ANTI-VACUITY FLOOR, ON THE EXACT POPULATION THE ASSERTIONS BELOW ACTUALLY WALK.
   * If `discoverStylesheets` silently found nothing — wrong root, wrong extension filter, a
   * filesystem error swallowed by an empty result — every assertion below would iterate an empty
   * array and PASS. 30 is comfortably below the 42 files present at the time this floor was
   * written, so ordinary file churn will not make this brittle, while a genuinely broken walk
   * (which returns 0) still fails it.
   */
  it(`discovers at least 30 *.module.css stylesheets under ${COMPONENT_ROOT}`, () => {
    expect(
      files.length,
      `the walk under ${COMPONENT_ROOT} found only ${files.length} stylesheet(s) — either the ` +
        `directory moved, the extension filter regressed, or the walk itself is broken. Every ` +
        `assertion below iterates this list and would pass vacuously on an empty one.`,
    ).toBeGreaterThanOrEqual(30);
  });

  const resolutions = allComposesResolutions(files);

  /**
   * ⚠️ TASK 3's ANTI-VACUITY FLOOR, ON THE DENOMINATOR, NOT THE NUMERATOR. This floors the number
   * of `composes:` edges the resolver RESOLVED (attempted to look up a target and classify), never
   * the number it found covered — a resolver that gives up and resolves nothing would satisfy a
   * floor on the covered count trivially (0 covered >= 0). 46 composed-class edges exist across
   * the tree at the time this floor was written (measured directly, not guessed); 40 is
   * comfortably below that so ordinary file churn will not make this brittle, while a resolver
   * that silently stops walking, or a regex that stops matching `composes:` lines at all, still
   * fails it.
   */
  it("resolves at least 40 composed-class edges across the discovered stylesheets", () => {
    expect(
      resolutions.length,
      `the composes: resolver found only ${resolutions.length} edge(s) — either the walk, the ` +
        `composes: regex, or the target-path resolution regressed. Every composition-coverage ` +
        `assertion below depends on this population being real.`,
    ).toBeGreaterThanOrEqual(40);
  });

  const analyses = files.map((f) => analyze(f, resolutions));

  /**
   * A second anti-vacuity floor, this one on the regex the coverage comparisons actually consume:
   * if `THEMED_COLOR` stopped matching anything (a rewritten token scheme, a broken regex), every
   * file's `declaring` array would be empty and `unexpectedlyBroken`/`fixedButStillListed` below
   * would both pass on nothing to compare, silently certifying a guard that checks zero rules.
   */
  it("finds at least one themed-colour declaration across the discovered stylesheets", () => {
    const total = analyses.reduce((sum, a) => sum + a.declaring.length, 0);
    expect(
      total,
      "zero rules anywhere in the discovered stylesheets declare a themed text colour — the " +
        "THEMED_COLOR regex likely regressed, and every coverage comparison below would pass on " +
        "empty lists",
    ).toBeGreaterThan(0);
  });

  it("every KNOWN_UNFIXED path still exists on disk", () => {
    const discovered = new Set(files);
    const stale = Object.keys(KNOWN_UNFIXED).filter((p) => !discovered.has(p));
    expect(
      stale,
      `KNOWN_UNFIXED names ${stale.length} path(s) not found by the walk (renamed, moved, or ` +
        `deleted) — that grants amnesty to nothing and must be corrected or removed: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  /**
   * ⚠️ SIDE ONE OF THE TWO-SIDED PIN. A discovered file that is NOT in `KNOWN_UNFIXED` must have
   * full print coverage. This is what catches a regression (someone deletes a reset) or a brand
   * new file that declares a themed colour and was never given one.
   */
  it("unexpectedlyBroken: every stylesheet not listed in KNOWN_UNFIXED has full print coverage", () => {
    const unexpectedlyBroken = analyses
      .filter((a) => !(a.path in KNOWN_UNFIXED))
      .filter((a) => a.uncovered.length > 0)
      .map((a) => `${a.path}: ${a.uncovered.join(", ")}`);
    expect(
      unexpectedlyBroken,
      "these stylesheets declare a themed text colour with no @media print reset that wins over " +
        "it, and are NOT in KNOWN_UNFIXED — on a dark-themed print the named selectors would " +
        "resolve to near-white text on white paper. Either add the missing print coverage, or " +
        "(only if this file is genuinely owned by another session and not yet fixed) add it to " +
        "KNOWN_UNFIXED with a note:\n" +
        unexpectedlyBroken.join("\n"),
    ).toEqual([]);
  });

  /**
   * ⚠️ SIDE TWO OF THE TWO-SIDED PIN, AND THE HALF A ONE-DIRECTIONAL AMNESTY LIST WOULD NEVER
   * HAVE. A `KNOWN_UNFIXED` entry that now has full coverage (another session landed its fix)
   * MUST be deleted from the map above. Leaving it in would make `KNOWN_UNFIXED` a one-way ratchet
   * that only ever grows — this assertion is what forces it to shrink back down as the rest of
   * the codebase gets fixed.
   */
  it("fixedButStillListed: every KNOWN_UNFIXED entry that is now fully covered must be removed from the list", () => {
    const fixedButStillListed = analyses
      .filter((a) => a.path in KNOWN_UNFIXED)
      .filter((a) => a.uncovered.length === 0)
      .map((a) => a.path);
    expect(
      fixedButStillListed,
      "these KNOWN_UNFIXED entries now have full print coverage — remove them from the " +
        "KNOWN_UNFIXED map in this file:\n" +
        fixedButStillListed.join("\n"),
    ).toEqual([]);
  });

  /**
   * ⚠️ TASK 2's NEGATIVE CONTROL — THE FIXTURE THAT SEPARATES A WORKING RESOLVER FROM AN EAGER
   * ONE. `ward-management-network.module.css` composes `descendantKill` from
   * `ward-reduced-motion.module.css`, which declares no `@media print` block at all (confirmed:
   * zero occurrences of either word in that file). A resolver that answers "this file composes
   * something, therefore covered" — without actually looking up the target — would pass every
   * assertion in this file EXCEPT this one. (The file's own `uncovered` array can't tell the
   * difference here: it declares zero themed colours of its own, so it is trivially "covered"
   * regardless of composition — this assertion is the only place that actually exercises the
   * resolver on this edge.)
   */
  it("TASK 2 negative control: ward-management-network.module.css's descendantKill edge is NOT covered by composition", () => {
    const edge = resolutions.find(
      (r) =>
        r.fromFile === "src/components/ward-management/ward-management-network.module.css" &&
        r.className === "descendantKill",
    );
    expect(edge, "the descendantKill composes edge must be found by the resolver").toBeDefined();
    expect(
      edge?.coveredByComposition,
      "ward-reduced-motion.module.css declares no @media print block at all, so this composed " +
        "class cannot carry a winning reset — a resolver reporting this covered is not resolving " +
        "the target, only noticing that composition exists",
    ).toBe(false);
  });

  /**
   * FIXTURE 2 (coordinator, 2026-09-04): `ed/ed-home.module.css` composes FOUR times — one ROOT
   * edge (`.screen` composes `wardTokens`, its only wardTokens edge, in its first rule) and three
   * NON-ROOT edges from `ward-shared.module.css`. Only `hint` is actually reset there; `hero` and
   * `heroFigures` are not, so those two edges must resolve to no coverage even though the compose
   * line itself parses fine — a resolver that conflates "found an edge" with "found coverage"
   * would get this wrong.
   */
  it("FIXTURE 2: ed-home.module.css's four composes edges each resolve correctly (root vs three non-root, one hit, two misses)", () => {
    const file = "src/components/ward-management/ed/ed-home.module.css";
    const inFile = resolutions.filter((r) => r.fromFile === file);
    expect(inFile.length, "ed-home.module.css composes four distinct (selector, class) edges").toBe(4);

    const root = inFile.find((r) => r.fromSelector === ".screen" && r.className === "wardTokens");
    const hint = inFile.find((r) => r.fromSelector === ".populationNote" && r.className === "hint");
    const hero = inFile.find((r) => r.fromSelector === ".heroBody" && r.className === "hero");
    const heroFigures = inFile.find((r) => r.fromSelector === ".heroFiguresGrid" && r.className === "heroFigures");
    expect(root, "root edge must be found").toBeDefined();
    expect(hint, "hint edge must be found").toBeDefined();
    expect(hero, "hero edge must be found").toBeDefined();
    expect(heroFigures, "heroFigures edge must be found").toBeDefined();

    expect(root?.isRoot, ".screen is ed-home's first rule and its only wardTokens edge — this must resolve ROOT").toBe(
      true,
    );
    expect(root?.coveredByComposition, "wardTokens carries a winning wildcard reset").toBe(true);

    expect(hint?.isRoot, ".populationNote is not the file's first rule — non-root").toBe(false);
    expect(
      hint?.coveredByComposition,
      "ward-shared.module.css's print block does reset .hint (bare, exact) — this edge covers " +
        "only .populationNote itself, but it must still resolve covered",
    ).toBe(true);

    expect(
      hero?.coveredByComposition,
      "ward-shared.module.css's print block does not mention .hero at all — this edge must " +
        "resolve to no coverage, not a false positive from merely finding the edge",
    ).toBe(false);
    expect(
      heroFigures?.coveredByComposition,
      "ward-shared.module.css's print block does not mention .heroFigures at all — same as hero",
    ).toBe(false);
  });

  /**
   * FIXTURE 1 (coordinator, 2026-09-04): `ward-management.module.css` composes `wardName`/`hint`
   * from `ward-shared.module.css` on two NON-ROOT selectors (`.rowName` line 781, `.rowNote` line
   * 786), which ward-shared's print block DOES reset. THE DISCRIMINATING CASE: a resolver that
   * answers "this file composes something covered, therefore the file is covered" would pass the
   * two assertions below and then wrongly wave through every other declaring selector in this
   * ~60-declaration file too. It must not — composition only ever explains what it actually
   * composes, and `ward-management.module.css`'s many OTHER declaring selectors (a small sample
   * asserted by name below) compose nothing at all; they are covered only by this file's own
   * pre-existing local `.patientWorkspace, .patientWorkspace *` print block, a separate mechanism
   * this task does not touch.
   */
  it("FIXTURE 1: composition covers only .rowName and .rowNote in ward-management.module.css, never the whole file", () => {
    const file = "src/components/ward-management/ward-management.module.css";
    const inFile = resolutions.filter((r) => r.fromFile === file);

    const rowName = inFile.find((r) => r.fromSelector === ".rowName" && r.className === "wardName");
    const rowNote = inFile.find((r) => r.fromSelector === ".rowNote" && r.className === "hint");
    expect(rowName, "the .rowName -> wardName edge must be found").toBeDefined();
    expect(rowNote, "the .rowNote -> hint edge must be found").toBeDefined();
    expect(
      rowName?.coveredByComposition,
      "ward-shared.module.css's print block resets .wardName (bare, exact) — this edge must " + "resolve covered",
    ).toBe(true);
    expect(
      rowNote?.coveredByComposition,
      "ward-shared.module.css's print block resets .hint (bare, exact) — this edge must resolve " + "covered",
    ).toBe(true);

    // The discriminator: these declaring selectors compose nothing at all in this file, so a
    // correct per-declarer resolver must find no composes edge for any of them — only a broken
    // "file composes something covered -> whole file covered" implementation would let composition
    // explain them.
    const declaringInFile = analyses.find((a) => a.path === file)?.declaring.map((d) => d.selector) ?? [];
    const composedFromSelectors = new Set(inFile.map((r) => r.fromSelector));
    const sample = [".avatar", ".rowRisk", ".legalRisk", ".governanceNote", ".gateItem"];
    for (const selector of sample) {
      expect(
        declaringInFile,
        `${selector} must actually be one of this file's declaring selectors — otherwise this sample proves nothing`,
      ).toContain(selector);
      expect(
        composedFromSelectors.has(selector),
        `${selector} does not compose anything in ward-management.module.css — composition must not explain it`,
      ).toBe(false);
    }

    // Cheaper negative from the same fixture family: search.module.css composes `field` from
    // ward-shared.module.css, and `.field` is not in ward-shared's print block — a resolved edge
    // whose target class carries no reset must contribute zero coverage.
    const fieldEdge = resolutions.find(
      (r) =>
        r.fromFile === "src/components/ward-management/search/search.module.css" &&
        r.fromSelector === ".field" &&
        r.className === "field",
    );
    expect(fieldEdge, "the .field -> field composes edge must be found").toBeDefined();
    expect(
      fieldEdge?.coveredByComposition,
      "ward-shared.module.css's print block does not reset .field — this edge must resolve to no coverage",
    ).toBe(false);
  });
});
