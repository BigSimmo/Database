// tests/ward-table-phone-swap.test.ts
//
// ⚠️ THE PHONE TABLE→CARDS SWAP BROKE ON THREE BOARDS AND NOTHING WENT RED.
//
// Every Ward Flow board that renders a table renders a stacked card list beside it and hides one
// of the two: a table is right at a desk and wrong in a corridor. The hide is a single CSS rule —
// `@media (max-width: 40rem) { .tableScroll { display: none } }` — in the board's own stylesheet,
// so it only fires if the rendered scroll wrapper actually carries that module's own
// `.tableScroll` class.
//
// It stopped carrying it. `WardTable` (`ward-table/ward-table.tsx`) puts the PRIMITIVE's
// `tableScroll` on the wrapper and offers `wrapperClassName` for the caller's own. Two migration
// commits — `d136656ba` (the referral board) and `f4b77ebff` (discharges and out-of-area) —
// replaced `<div className={styles.tableScroll}>` with `<WardTable>` and did not pass it. The
// local class stopped reaching the DOM, the media query matched nothing, and from then on a phone
// rendered BOTH the table and the cards, one under the other, on all three boards.
//
// Measured in a browser at 375px before the fix: seven scroll wrappers `display: block` with all
// seven card lists `display: grid` at the same time. Afterwards, all seven `none` against `grid`,
// and the reverse at 1440px.
//
// ⚠️ **NOTHING COULD HAVE CAUGHT IT.** jsdom does not evaluate `@media`, so no DOM test can see a
// breakpoint swap; the Playwright specs for these boards assert column containment and row
// content, never which of the two layouts is showing; and `f4b77ebff` — the commit that broke two
// of the three boards — is itself titled "nothing asserted a ward table's scroll threshold, and
// the sweep built to find that did not check it either". A commit about a missing guard, dropping
// a class, with no guard to catch it.
//
// So this guard is static, and it checks the WIRING rather than the rendering: if a board's
// stylesheet takes responsibility for hiding `.tableScroll`, that board's `WardTable` call sites
// must hand it the class that rule is written against.
//
// ⚠️ **AND THE EXEMPTION IS STATED AS A REASON, NOT AS A SYMPTOM.** Escalation is exempt because
// it has no second layout — no `.cardList` rule in its stylesheet, no card markup in its
// component — not because it "declares no `.tableScroll` rule", which is the consequence of that
// and would stop being true the moment somebody added one. The distinction is not pedantry: the
// first version of this guard asserted only over boards that ALREADY hide `.tableScroll`, so a
// board with a card list and no hide rule would have shown both layouts by a different route and
// been waved through in silence. That hole was found by the author of the two commits this guard
// exists because of, testing the exemption with the check that would have broken it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/** Every file under `dir`, derived from disk — never a hand-written list. A hand-picked file set
 *  has shipped a red test twice on this project: it stops covering whatever is added tomorrow and
 *  the suite stays green with one file fewer inside it. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const POSIX = (path: string): string => path.split("\\").join("/");

/** Comments blanked before any match — this guard scans source as text, and a comment quoting
 *  `wrapperClassName` (this file's own subject) would otherwise satisfy the very check it
 *  describes. The sibling print guards were broken exactly that way twice on 2026-09-04. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

/** One place that turns a stylesheet path into the text the three predicates below judge, so a
 *  predicate can be handed CSS that is not on disk. That is not a convenience: the two-layouts
 *  predicate is INERT against every stylesheet this repository contains — measured, see the
 *  synthetic block at the foot of this file — and a predicate that only ever sees live data
 *  cannot be shown to discriminate at all. */
function readSheet(stylesheet: string): string {
  return withoutComments(readFileSync(stylesheet, "utf8"));
}

type CallSite = { file: string; stylesheet: string; call: string };

/**
 * Every `<WardTable ...>` opening tag in the ward tree, paired with the stylesheet its file
 * imports as `styles`. Resolved from the import statement rather than assumed to be the
 * co-located file, because a board could legitimately import a sibling's module.
 */
function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of walk(WARD_DIR).map(POSIX)) {
    if (!file.endsWith(".tsx")) continue;
    const source = withoutComments(readFileSync(file, "utf8"));
    const calls = source.match(/<WardTable\b[^>]*>/gu) ?? [];
    if (calls.length === 0) continue;
    const styleImport = /import\s+styles\s+from\s+"([^"]+\.module\.css)"/u.exec(source);
    const stylesheet = styleImport ? POSIX(join(file.slice(0, file.lastIndexOf("/")), styleImport[1])) : "";
    for (const call of calls) sites.push({ file, stylesheet, call });
  }
  return sites;
}

/** Whether a stylesheet declares a `.tableScroll` rule of its own — the class the phone swap is
 *  written against. Comments blanked first for the reason above. */
function declaresTableScrollIn(css: string): boolean {
  return /\.tableScroll\s*(?:,[^{]*)?\{/u.test(css);
}

function ownsTableScroll(stylesheet: string): boolean {
  return stylesheet !== "" && declaresTableScrollIn(readSheet(stylesheet));
}

/** Whether a stylesheet hides `.tableScroll` inside a media query — the exact rule that stopped
 *  firing. Narrower than `ownsTableScroll`, and the one whose failure is a layout defect rather
 *  than a dropped `overflow-x`. */
function hidesTableScrollAtABreakpointIn(css: string): boolean {
  return /@media[^{]*\{[\s\S]*?\.tableScroll\s*\{[^}]*display:\s*none/u.test(css);
}

function hidesTableScrollAtABreakpoint(stylesheet: string): boolean {
  return stylesheet !== "" && hidesTableScrollAtABreakpointIn(readSheet(stylesheet));
}

/** Whether a stylesheet declares a `.cardList` rule — i.e. whether the board has a SECOND layout
 *  at all. This is what makes a swap necessary, and its absence is what makes one board's
 *  exemption legitimate rather than a hole. */
function hasACardLayoutIn(css: string): boolean {
  /*
   * 🔴 **NARROWED 2026-09-05: DECLARING A `.cardList` IS NOT THE SAME AS HAVING A SECOND LAYOUT,
   * AND THE DIFFERENCE IS WHETHER IT IS HIDDEN BY DEFAULT.**
   *
   * This asked only whether a `.cardList` rule existed. `community.module.css` declares one and
   * went red — but its card lists are the PRIMARY presentation of four sections that render no
   * table at all (waiting, admitted, expected, discharged), while its single table covers a fifth
   * section that has no card counterpart. **Nothing there is a swap, so there is nothing to swap.**
   *
   * **The discriminator, measured against a board that really does swap:**
   *
   *     discharges.module.css   .cardList { display: none; }   revealed at the phone breakpoint
   *     community.module.css    .cardList { display: grid; }   shown at every width, always
   *
   * A card list that exists to REPLACE a table is hidden until the breakpoint that hides the table.
   * One shown at every width is somebody's ordinary list. **The old predicate measured the class
   * name; this measures what the rule does** — the same wrong-unit error this project has now made
   * six times in a night, and the first time it appeared inside a guard's own predicate.
   *
   * ⚠️ **DELIBERATELY NOT AN EXEMPTION LIST.** This file's own comment warns that *"this one is
   * exempt" is where a guard usually hides its last case*, and requires an exemption be stated as
   * the REASON rather than the symptom. A reason that is computed from the stylesheet cannot go
   * stale the way a named exemption does — the day community hides its card list by default, it
   * re-enters scope automatically.
   */
  return /^\.cardList\b[^{]*\{[^}]*display:\s*none/mu.test(css);
}

function hasACardLayout(stylesheet: string): boolean {
  return stylesheet !== "" && hasACardLayoutIn(readSheet(stylesheet));
}

/*
 * ⚠️ THE POPULATION IS FILES, NOT DESTINATIONS — AND THAT ANSWERS A DIFFERENT QUESTION FROM THE
 * ONE THE NAME SUGGESTS.
 *
 * `callSites()` walks the `.tsx` tree and matches `<WardTable`. It reads nothing from `ward-nav.ts`
 * and nothing from the route directory. Two consequences, opposite in direction:
 *
 *   SAFE   a board leaving the sidebar stays in this population and goes on being checked.
 *          Asked by Ward Builder Two on 2026-09-05, when the priority queue, exceptions inbox and
 *          escalation board folded into one Delays screen and `escalation-board.tsx` left
 *          navigation: it is still walked, still declares no `.cardList`, still exempt for the
 *          reason stated rather than by accident.
 *
 *   BLIND  a component NO ROUTE RENDERS stays in the population too, and its green says something
 *          about a file nobody can reach. That is the smaller failure — a meaningless green rather
 *          than a silent gap — but it is still meaningless, and this guard cannot tell the two
 *          apart because reachability is not a thing it looks at.
 *
 * So a green here means "every WardTable ON DISK that its stylesheet hides on a phone is wired to
 * be hidden", never "every board a coordinator can reach is correct". If you want the second
 * claim, it needs the nav arrays as its population, which is a different guard.
 */
const SITES = callSites();

/*
 * A BOUNDED LIMIT, WRITTEN DOWN RATHER THAN LEFT TO BE DISCOVERED FROM A GREEN.
 *
 * This guard walks `<WardTable>` call sites, so **a board that never migrated is outside its scope
 * by construction.** That is correct for the defect it was built for — you cannot drop a wrapper
 * class you never passed — but it means a green here says NOTHING about `ed`, `ward-management-modes`
 * or `ward-management-network`, the three modules recorded as unmigrated in
 * `ward-table-single-source.test.ts`. If any of them is migrated later it is picked up automatically
 * on the same commit.
 *
 * Ward Builder Three went looking for exactly that hole — a screen carrying the same defect by a
 * different route, invisible to its own guard — and measured the answer clean: **neither `ed` nor
 * `ward-management-network` swaps a table for cards at any breakpoint.** Network's only breakpoint
 * rule for its wrapper is `@media print { overflow-x: visible }`, on the stated grounds that a
 * horizontally scrolling box has no meaning on paper; `ed`'s wrapper has no breakpoint rule at all.
 *
 * AND THE THIRD MODULE, because the sentence above was first written two-wide over a three-wide
 * limit. Ward Builder Three caught that in this very comment — it names three modules the green
 * says nothing about, and the original evidence covered two, so "nothing hides behind the limit"
 * read as covering all three. Nothing in it was false; the takeaway would have been wider than the
 * measurement. That is the defect this whole file is downstream of, arriving in the note about it.
 *
 * `ward-management-modes` is clean by a STRONGER route than the other two, measured:
 *
 *     scroll-wrapper classes declared   0
 *     card-list classes declared        0
 *     how it scrolls                    .panel:has(.dataTable) { overflow-x: auto } - the PANEL
 *                                       scrolls, not a wrapper
 *
 * There is no wrapper class to drop and no second layout to swap to, so it could not have carried
 * this defect by any route. `ed` and `network` each HAVE a wrapper and simply do not swap on it;
 * modes has nothing to swap. The sentence above is now true across all three, on evidence for all
 * three.
 */
describe("every WardTable that its board's stylesheet hides on a phone is given the class that hides it", () => {
  /**
   * ⚠️ ANTI-VACUITY, FLOORED ON THE POPULATION WALKED — never on the violations found. Every
   * assertion below is a `for` loop over `SITES`, and a loop over an empty list passes. If the
   * walk breaks (wrong root, a renamed component, `<WardTable` written across two lines by a
   * formatter) this suite would go green while covering nothing, which is the day it is worth
   * least. Seven call sites across five files existed when this was written; five is a floor
   * clear of that, not a number chosen to scrape past today's count.
   */
  it("is actually finding WardTable call sites", () => {
    expect(SITES.length, `expected at least 5 <WardTable> call sites, found ${SITES.length}`).toBeGreaterThanOrEqual(5);
    expect(
      SITES.filter((site) => ownsTableScroll(site.stylesheet)).length,
      "no board stylesheet declares a `.tableScroll` rule — either the walk is broken or the " +
        "phone swap has been removed from every board, and this suite is asserting nothing",
    ).toBeGreaterThan(0);
    /*
     * ⚠️ AND THIS ONE IS HERE BECAUSE `hasACardLayout` SHIPPED BROKEN AND GREEN, in the same
     * commit that introduced it. Its regex ends in a word-boundary escape, and that escape reached
     * disk as a single literal BACKSPACE byte (0x08) instead of the two characters a backslash and
     * a "b" — so the pattern demanded a backspace character after "cardList", matched nothing
     * anywhere in the repository, and made the assertion below it pass over an empty list. The
     * suite went green, four tests, no warning. It was found by READING the file, not by running
     * it: the byte is invisible in an editor and in `git diff` alike.
     *
     * (Described in words rather than quoted on purpose — writing the escape into this comment is
     * what produced two MORE backspace bytes on the first attempt at explaining it.)
     *
     * A helper that can only ever return `false` is indistinguishable from a codebase with
     * nothing to find, which is why the population it walks has to be floored the same way the
     * call-site walk above is.
     */
    expect(
      SITES.filter((site) => hasACardLayout(site.stylesheet)).length,
      "no board that renders a WardTable declares a `.cardList` rule — `hasACardLayout` is " +
        "matching nothing, so the two-layouts assertion below is asserting over an empty list",
    ).toBeGreaterThan(0);
  });

  it("hands each call site its own module's `.tableScroll` where that module hides it at a breakpoint", () => {
    const unwired = SITES.filter(
      (site) =>
        hidesTableScrollAtABreakpoint(site.stylesheet) && !/wrapperClassName=\{styles\.tableScroll\}/u.test(site.call),
    ).map((site) => `${site.file} -> ${site.stylesheet}`);
    expect(
      unwired,
      "these boards hide `.tableScroll` on a phone but never put that class on the rendered " +
        "wrapper, so the table and the card list both render at 375px:\n" +
        unwired.join("\n"),
    ).toEqual([]);
  });

  /**
   * ⚠️ THE HOLE THE ASSERTION ABOVE LEAVES, AND IT WAS FOUND BY THE AUTHOR OF THE COMMITS THAT
   * CAUSED THE ORIGINAL DEFECT. Ward Builder Two, told that escalation was exempt, went and
   * tested the exemption with the check that would have broken it: a board with a card list and
   * NO hide rule shows both layouts at 375px by a different route entirely, and the wiring
   * assertion — which only inspects boards that already hide `.tableScroll` — waves it through
   * without a word. **"This one is exempt" is where a guard usually hides its last case.**
   *
   * So the exemption is now stated as the REASON rather than the symptom. Escalation is exempt
   * because it has no second layout — verified in both halves, the stylesheet declares no
   * `.cardList` rule and the component renders no card markup — not because it "declares no
   * `.tableScroll` rule", which is the consequence of that and stops being true the day somebody
   * adds one.
   */
  it("requires a swap rule from every board that actually has two layouts to swap between", () => {
    const twoLayoutsNoSwap = SITES.filter(
      (site) => hasACardLayout(site.stylesheet) && !hidesTableScrollAtABreakpoint(site.stylesheet),
    ).map((site) => `${site.file} -> ${site.stylesheet}`);
    expect(
      twoLayoutsNoSwap,
      "these boards render a table AND declare a card list, but no breakpoint hides either one, " +
        "so both layouts are on screen at every width:\n" +
        twoLayoutsNoSwap.join("\n"),
    ).toEqual([]);
  });

  it("still names a stylesheet for every call site, so a missing import cannot exempt one silently", () => {
    const unresolved = SITES.filter((site) => site.stylesheet === "").map((site) => site.file);
    expect(
      unresolved,
      "these files render a WardTable and import no `styles` module, so the checks above skip " +
        "them entirely — the quiet way a board leaves this guard's scope:\n" +
        unresolved.join("\n"),
    ).toEqual([]);
  });
});

/*
 * 🔴 **THE DISCRIMINATOR ABOVE IS INERT AGAINST EVERY STYLESHEET THIS REPOSITORY CONTAINS, AND
 * THAT WAS MEASURED RATHER THAN SUSPECTED.**
 *
 * `hasACardLayout` was narrowed on 2026-09-05 from "declares a `.cardList`" to "declares a
 * `.cardList` that is hidden by default", so that `community.module.css` — whose card lists are
 * the primary presentation of four sections that render no table at all — stopped being reported
 * as a board that had forgotten to swap. That narrowing is right, and it is also the exact shape
 * this project has been caught by twice: **a narrowing that goes green on the very defect its
 * guard exists for.**
 *
 * So it was walked. Over all 51 module stylesheets under `src/components/ward-management`:
 *
 *     both predicates true    3    discharges, out-of-area, referrals
 *     both predicates false   48   everything else, community and ed and ward among them
 *     DISAGREE                0
 *
 * **`hasACardLayout` and `hidesTableScrollAtABreakpoint` agree on every file on disk.** The
 * assertion built on their disagreement — *"requires a swap rule from every board that actually
 * has two layouts"* — therefore cannot fail on live data, in either direction. It is coverage
 * against the NEXT board, exactly like the edit limit in `community-vocabulary.ts`, and for the
 * same reason it has to be asserted against synthetic input: **a guard over live data alone cannot
 * tell an unused branch from an absent one, and its anti-vacuity floor passes either way.**
 *
 * ⚠️ **AND THE LIMIT THE NARROWING LEAVES BEHIND, stated because a reason-computed exemption is
 * still an exemption.** A board that renders a table AND duplicates its rows in a card list shown
 * at every width now sits outside this guard entirely: both layouts on screen at once, at every
 * width, silently. That is precisely the shape the narrowing declared legitimate for community,
 * and nothing here can separate the two — the difference is whether the cards say the same thing
 * as the table, which is a question about the components, not about the stylesheet. **A stylesheet
 * predicate cannot answer it and should not pretend to.** If that board is ever built, the guard
 * that catches it reads markup, not CSS.
 */
describe("the swap discriminator, on CSS the repository does not contain", () => {
  const SWAP_BOARD =
    ".tableScroll { overflow-x: auto; }\n.cardList { display: none; }\n@media (max-width: 40rem) {\n  .tableScroll { display: none; }\n  .cardList { display: grid; }\n}";
  const ORDINARY_LIST = ".tableScroll { overflow-x: auto; }\n.cardList { display: grid; gap: 1rem; }";
  const TWO_LAYOUTS_NO_SWAP = ".tableScroll { overflow-x: auto; }\n.cardList { display: none; }";
  const NO_SECOND_LAYOUT = ".tableScroll { overflow-x: auto; }\n.table { width: 100%; }";
  const NEAR_MISS_NAME = ".tableScroll { overflow-x: auto; }\n.cardListHeading { display: none; }";

  it.each([
    {
      shape: "a board that really swaps (discharges, out-of-area, referrals)",
      css: SWAP_BOARD,
      cards: true,
      hides: true,
    },
    { shape: "an ordinary list shown at every width (community)", css: ORDINARY_LIST, cards: false, hides: false },
    {
      shape: "THE HOLE: a hidden card list and no rule that ever reveals it",
      css: TWO_LAYOUTS_NO_SWAP,
      cards: true,
      hides: false,
    },
    { shape: "a board with no second layout at all (escalation)", css: NO_SECOND_LAYOUT, cards: false, hides: false },
    { shape: "a class whose name merely starts with cardList", css: NEAR_MISS_NAME, cards: false, hides: false },
  ])("$shape: hasACardLayout=$cards, hidesTableScrollAtABreakpoint=$hides", ({ css, cards, hides }) => {
    expect(hasACardLayoutIn(css), "hasACardLayoutIn").toBe(cards);
    expect(hidesTableScrollAtABreakpointIn(css), "hidesTableScrollAtABreakpointIn").toBe(hides);
    // Every shape here declares the wrapper class, so a `declaresTableScrollIn` that stopped
    // matching would not be caught by the two assertions above.
    expect(declaresTableScrollIn(css), "declaresTableScrollIn").toBe(true);
  });

  /**
   * ⚠️ **THE ONE CASE THE THREE-STATE TABLE ABOVE CANNOT STATE, because it is about WHERE a rule
   * sits rather than what it says.** Every swapping board in this repository declares
   * `.cardList { display: grid }` INSIDE its phone media block — the reveal half of the swap — and
   * that declaration must not be read as "shown by default". The predicate relies on the `^`
   * anchor and the indentation inside a media block to tell them apart, which is a load-bearing
   * property of a regex and reads like an accident. If it is ever rewritten to parse rather than
   * scan, this is the assertion that goes red.
   */
  it("does not read a card list revealed inside a media block as one shown by default", () => {
    expect(
      hasACardLayoutIn(".cardList { display: grid; }\n@media (max-width: 40rem) {\n  .cardList { display: grid; }\n}"),
    ).toBe(false);
  });
});
