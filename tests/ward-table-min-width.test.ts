// tests/ward-table-min-width.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY WARD TABLE'S SCROLL THRESHOLD, PINNED TO THE VALUE IT HAD BEFORE THE `WardTable` EXTRACTION.
 *
 * 🔴 WHY THIS FILE EXISTS. Six ward stylesheets each declared their own copy of the same table
 * body, differing in exactly one live property: `min-width`, the width below which the table
 * scrolls instead of squashing. It is a fact about how many columns a screen has, not a preference.
 *
 * ⚠️ **AND NOTHING IN THIS REPOSITORY ASSERTED IT.** Ward Builder Three found the gap while
 * characterising the six variants, and named the part that makes it dangerous: *its own sweep tool
 * does not check `min-width` either.* So a module migrated onto the shared block **without** its
 * threshold carried across is green in every instrument the project has — the table silently stops
 * scrolling and starts squashing, on a screen a coordinator reads under pressure, and no test, no
 * gate and no sweep says a word. That is the likeliest silent regression in the whole extraction,
 * which is why the guard is written rather than the value merely reported.
 *
 * **The property asserted is the EFFECTIVE THRESHOLD, not how it is spelled.** A module satisfies
 * this whether it declares `min-width: 30rem` directly (pre-migration) or sets
 * `--ward-table-min-width: 30rem` for the shared block to consume (post-migration). That is
 * deliberate: the extraction is landing module by module, and a guard that demanded one spelling
 * would be red for every module not yet migrated and would have to be edited as each one lands —
 * which is a guard that gets relaxed rather than one that holds.
 */

/*
 * A THRESHOLD BELOW A TABLE'S INTRINSIC MINIMUM IS INERT, AND LOOKS IDENTICAL TO A WORKING ONE.
 *
 * Ward Builder One measured this on the running page, 2026-09-05, and found it in its own work: it
 * had written `30rem` for the compare screen's department table. That table's intrinsic minimum and
 * its max-content width are the SAME 36.53rem, because every cell is a nowrap header or a short
 * figure and nothing can wrap. **So 30rem could never take effect.** It is indistinguishable from a
 * working threshold in the stylesheet, in this pin file, and on the page at every width above it.
 *
 * WHAT THIS FILE CAN AND CANNOT SEE. It asserts a threshold has not silently CHANGED - which is
 * worth having and is what it was built for. **It cannot tell an effective threshold from an inert
 * one**, because that needs a table's intrinsic minimum, which needs a browser, which no offline
 * guard has.
 *
 * SO THE HONEST STATE OF THIS MAP, kept current as entries are measured rather than left to
 * describe the day it was written: the queue's 46rem, the compare screen's two, and — added at the
 * merge that brought this comment onto that branch — **`referrals` at 30rem**, measured at a 641px
 * viewport against a 499px scroller by the same method, after 40rem was found putting two columns
 * of each board table off the screen. The rest are read out of stylesheets. **If a threshold was
 * chosen by eye rather than measured, it may be inert and nothing here will ever say so.**
 *
 * ⚠️ **AND A SENTENCE THAT COUNTS THIS FILE'S OWN MEASURED ENTRIES GOES STALE THE NEXT TIME
 * SOMEBODY MEASURES ONE.** It said "one entry" and was already wrong about its own file by the
 * time the two branches met — not through carelessness, but because a hand-maintained tally of a
 * list sitting six lines below it has no way to notice the list moving. It is kept as a NAMED
 * list rather than a count for that reason: adding a name is a thing the next person will
 * actually do, and "one entry" is a thing they would have had to notice was wrong first.** That is not a defect in the pins; it is the boundary of what a text-reading guard can
 * assert, written down so a green is not read as "these thresholds work".
 *
 * A cheap way to check one, for anyone with the dev server up: neutralise the table's own
 * `min-width`, let the wrapper size to content, and compare the table's intrinsic minimum with the
 * declared threshold. If the threshold is the smaller number, it does nothing.
 */

const WARD_DIR = "src/components/ward-management";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * Measured at `db4af99e4` across every rule whose selector mentions `.table` — not just the
 * `.table { }` block, which is the mistake that produced two phantom "byte-identical pairs" in the
 * first characterisation of these files. `null` means the module deliberately declares no
 * threshold.
 *
 * ⚠️ A CHANGE TO ONE OF THESE NUMBERS IS A DESIGN DECISION ABOUT A SPECIFIC SCREEN. It is not a
 * merge artefact and it is not tidying. If a screen gains or loses columns the number moves — but it
 * moves in a commit that says which screen and why, which is the whole point of pinning it.
 */
/*
 * ⚠️ **THE VALUE MAY BE AN ARRAY, AND IT HAD TO BECOME ONE.** Until 2026-09-05 this was
 * `string | null` — one threshold per file — and `capacity.module.css` arrived declaring TWO
 * (34rem and 40rem, two different tables in one stylesheet). Pinning either alone would have
 * satisfied the discovery check below while leaving the other completely unwatched, **and the map
 * would have read as though the file were pinned.** That is this file's own recurring defect one
 * more time: a registry that looks exhaustive because every entry it has is correct.
 */
const PINNED: Record<string, string | readonly string[] | null> = {
  "discharges/discharges.module.css": "30rem",
  "escalation/escalation.module.css": "44rem",
  "handover/handover.module.css": null,
  "out-of-area/out-of-area.module.css": "30rem",
  /* 40rem until 2026-09-05, when it was measured at the narrowest width this table is used at
     (641px viewport, 499px scroller) and found to put `Sex` and `Home region` outside the queued
     table and `Waited` and `Decided` outside the decided one. 30rem fits that box exactly, stays
     above both intrinsic minimums (25.16rem / 18.76rem), and matches `discharges` and
     `out-of-area`, which chose it against the same 499px scroller. See the stylesheet. */
  "referrals/referrals.module.css": "30rem",
  "search/search.module.css": "44rem",
  /*
   * MEASURED 2026-09-05 ON THE RUNNING PAGE, and the entry below is no longer an estimate.
   * Ward Builder One swept the wrapper width on `/mockups/ward-flow/queue` — 7 columns, 43 seeded
   * rows — with the table's own `min-width` neutralised so it could show its natural shape:
   *
   *     1200-888px   table height 1363px   uncompressed, dead flat across 312px of width
   *     886px                              first growth: THE KNEE, 888px = 55.5rem
   *     880px        1975px                +45%
   *     870px below  2137px                +57%
   *     736px=46rem  2137px                THE DECLARED THRESHOLD, fully inside the wrapped zone
   *     450px below  4981px                floors out at 3.7x uncompressed
   *
   * RULED: 46rem STANDS. The finding is not "46rem is wrong" — the token is a deliberate tolerance
   * for wrapping, and the sweep's other result is what settles it: **no cell overflows at ANY width
   * down to 300px, at every step.** This table degrades by WRAPPING, never by clipping, so below the
   * threshold the failure mode is a tall table and not hidden content. Raising the threshold to the
   * knee would force horizontal scrolling onto more screens to buy a shorter table, and content is
   * never lost either way. **A tall table on a phone beats a sideways-scrolling one.**
   *
   * ⚠️ The property worth caring about is the one the sweep found for free — degrades by wrapping,
   * not by clipping — rather than the pixel. If a future change makes this table clip, the number
   * stops being a tolerance and becomes a defect.
   *
   * Caveats kept, because a measured number travels further than its caveat: one page, one browser,
   * default font and zoom, width applied to the wrapper rather than the viewport (so page chrome is
   * excluded), and 43 SEEDED rows — a longer value in real data moves the knee right, never left.
   *
   * EVERY OTHER NUMBER IN THIS MAP IS STILL A STYLESHEET READING, not a measurement.
   *
   * The original note, kept because the reasoning for pinning an unverified value still holds:
   *
   * PROVISIONAL, AND SAID SO RATHER THAN LEFT OUT. QueueView's table was rebuilt on the primitive
   * at `120855dea`, and its implementer flagged this number as its own unverified estimate: this
   * codebase's convention treats a scroll threshold as trustworthy only after real-browser
   * measurement, which was outside that task's proof list.
   *
   * PINNED ANYWAY, because pinning means "this must not change silently", not "this is correct".
   * An unpinned seventh table would make a six-entry map read as "these are the ward tables" when
   * there are seven — the same way an emptied allowlist read as "the estate is clean" a few hours
   * ago. When somebody measures it at 375px and it turns out wrong, this line goes red, which is
   * exactly the conversation that should happen.
   */
  "ward-modes-second-edition.module.css": "46rem",
  /*
   * 🔴 FOUND BY THE DISCOVERY ASSERTION BELOW ON ITS FIRST RUN, NOT BY ANYBODY READING THIS MAP.
   * `ward-management-modes.module.css` declares `.dataTable { min-width: 48rem }` and was the
   * NINTH table threshold in an estate this map listed eight of.
   *
   * ⚠️ PINNED AT THE VALUE IT HAS, WHICH IS NOT THE SAME CLAIM AS PINNING A MEASUREMENT. I have not
   * put this table in a browser: 48rem is what the stylesheet says today, and it may be inert, it
   * may be an over-pin, and nothing here can tell. Same handling as the QueueView row above, and for
   * the same reason — pinning means "this must not change silently", never "this is correct". When
   * somebody measures it and the number moves, this line goes red, which is the conversation that
   * should happen.
   *
   * ⚠️ AND IT IS NOT A `WardTable`. `ward-management-modes` is one of the three modules deliberately
   * left out of the single-source migration — different token layer, different border-collapse mode,
   * a sticky header — so it consumes no `--ward-table-min-width` and its threshold is a plain
   * `min-width`. This map already asserts the EFFECTIVE threshold rather than its spelling, which is
   * why an unmigrated module can sit here beside migrated ones.
   */
  "ward-management-modes.module.css": "48rem",
  /*
   * MEASURED, not estimated, on the running page 2026-09-05 — 23 seeded wards, 8 departments,
   * default font and zoom.
   *
   * ⚠️ **RE-MEASURED THE SAME DAY, AND THE FIRST FIGURE WAS ALREADY STALE.** It was 50.5rem, above
   * a max-content of 50.06rem, correct for a SIX-column table. `Empty-bed time` was then removed
   * on Ward Lead's ruling — it was arithmetically incapable of varying — and the five-column table
   * measures **37.82rem, with max-content and intrinsic minimum equal**, because every cell is a
   * nowrap header or a short figure and nothing in it can wrap.
   *
   * **A pin left at 50.5rem would not have been inert. It would have been WORSE than inert:** a
   * third wider than the table needs, forcing a horizontal scroll where none was required and
   * pushing columns off the visible scroller at widths where they would otherwise have fitted.
   * **An over-pin is invisible in exactly the same places an under-pin is** — the stylesheet reads
   * as deliberate, this map reads as measured, and the page looks fine at desk width. So 38rem,
   * just above the measured 37.82rem. **A threshold measured against a table that has since
   * changed shape is not a measurement any more.**
   *
   * ⚠️ **AND IT WENT STALE A SECOND TIME THE SAME DAY, FROM A CHANGE THAT WAS NOT ABOUT WIDTH AT
   * ALL.** Pinning the identity column released `white-space: nowrap` on the row headers so a
   * service's full name could wrap; max-content fell from 37.82rem to 34.82rem, and 38rem became an
   * over-pin again. **Three stale readings in one day, every one of them correct when taken, none of
   * them wrong through carelessness** — a column removed, then a wrapping rule relaxed. Nothing in
   * this repository connects a table's SHAPE to the pin that was measured for it, so the same
   * hazard sits on every row of this map.
   *
   * ⚠️ THIS FILE DECLARES TWO THRESHOLDS AND THIS MAP CAN PIN ONE PER FILE. The second is the
   * department table at 27.5rem, and it is NOT pinned here. It is named rather than left silent:
   * `thresholds()` returns both, and the assertion below is `found.includes(expected)`, so the
   * unpinned one can change without going red. If a second statistics table is worth pinning, this
   * map's shape has to change first — which is a decision, not an edit I should make while adding
   * a row to it.
   *
   * ⚠️ AND THE DEPARTMENT TABLE IS WHY MEASURING MATTERS RATHER THAN ESTIMATING. It was written
   * as 30rem, and 30rem was INERT: that table's intrinsic minimum and its max-content width are the
   * same 36.53rem, because every cell is a nowrap header or a short figure and nothing in it can
   * wrap. A threshold below a table's own minimum changes nothing, and looks identical to a working
   * one in the stylesheet, in this map, and on the page at any width above it.
   */
  "statistics/statistics-sections.module.css": "35rem",
  /*
   * ⚠️ ARRIVED WITH MERGE 02 ON 2026-09-05 AND WAS NOT PINNED, so the discovery check below was red
   * on the integration line and nobody saw it — the ward suite was being run from hand-picked file
   * lists and no list included this test. TWO tables, two thresholds, both pinned: the network
   * table at 34rem and the bed-kind mismatch table at 40rem.
   *
   * Pinned at the values they have, which is not the same claim as pinning a measurement — neither
   * has been measured against its narrowest scroller the way `referrals` and `queue` were. If one
   * moves, it should move in a commit that says which table and why.
   */
  "capacity/capacity.module.css": ["34rem", "40rem"],
  /*
   * Arrived with the community rebuild. 34rem, and this one IS derived rather than chosen: the
   * stylesheet records it as the table's own floor (544px) against a 20rem rail, which is what
   * settled its 64rem breakpoint. See the comment at that media query.
   */
  "community/community.module.css": "34rem",
};

/**
 * Every `min-width` / `--ward-table-min-width` this stylesheet DECLARES, in source order.
 *
 * 🔴 **A MEDIA QUERY IS NOT A DECLARATION, AND THE FIRST VERSION OF THIS COUNTED ONE.**
 * `referrals.module.css` carries `@media (min-width: 40rem)` at line 411 — a breakpoint — and
 * `min-width: 40rem;` at line 496 — the table's scroll threshold. The two are unrelated and happen
 * to share a number. The original pattern matched both, so **deleting the real threshold left the
 * breakpoint satisfying the assertion, and the guard passed on a screen it no longer protected.**
 *
 * Proved rather than reasoned: mutating line 496 alone to `min-width: 0` and running this file
 * returned `🔴 THE MUTANT SURVIVED. Nothing went red.` A guard that cannot fail on the one thing it
 * exists to catch — the exact class of defect this project keeps finding, written by the person who
 * had just written a commit message about that class.
 *
 * ⚠️ **AND I DID NOT FIND IT. The mutation harness's ambiguity guard did**, by refusing
 * `--find "min-width: 40rem"` because it matched twice. Its refusal message names the reason
 * exactly — *the first match is very often the doc comment ABOUT the value rather than the value* —
 * and here it was a media query rather than a comment. **A refusal I had to work around was the
 * finding.**
 *
 * So: require the trailing semicolon of a declaration, and reject a match immediately preceded by
 * `(`, which is what a media condition looks like.
 */
function thresholds(css: string): string[] {
  /*
   * 🔴 COMMENTS STRIPPED FIRST, AND THIS IS THE THIRD TIME IN ONE NIGHT.
   *
   * Ward Verifier attacked the repaired pattern on seven cases. It survived every media-query shape
   * — including one ending in a semicolon, which was the case expected to break the lookbehind —
   * and failed on one: a commented-out declaration — the same text wrapped in a block comment —
   * **satisfied the presence assertion.** So somebody
   * commenting the threshold out while debugging, and committing it, leaves this guard green with
   * the threshold gone.
   *
   * ⚠️ Same shape as the media query, in a third costume. Verifier's rule, and it is now a rule
   * rather than three separate fixes: **a guard that scans source text is satisfied by prose unless
   * it excludes prose.** Tonight that has been a media condition here, a commented-out declaration
   * here, and — in the other direction — a font-family guard that went RED on a comment quoting the
   * thing it forbids.
   */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Anti-vacuity on the strip itself: a stylesheet that is almost entirely comment would leave
  // nothing behind, and "no threshold found" would then mean "the strip ate the file".
  if (css.length > 400 && code.trim().length < 100) {
    throw new Error("comment stripping removed nearly the whole stylesheet");
  }

  /*
   * 🔴 SCOPED TO THE TABLE RULES — FOURTH COSTUME, AND WARD BUILDER THREE FOUND IT.
   *
   * The previous version searched the WHOLE stylesheet. It correctly excluded media conditions and
   * comments, and still could not tell the table's threshold from **any other `min-width`
   * declaration in the same file**: `found.includes(expected)` only asked whether the value appears
   * somewhere. So a module carrying an unrelated `min-width: 30rem;` on some other rule could lose
   * its table threshold entirely and stay green.
   *
   * ⚠️ Its words, and this is the part that generalises: *all six are safe today, but that is a
   * property of those files, not of the guard.* Nothing holds it true tomorrow. A guard that passes
   * because of the estate's current shape rather than because of what it asserts is one edit from
   * being decorative — see the media condition, the commented-out declaration, and a font guard that
   * went red on a comment quoting what it forbids. Same defect, four costumes, one night.
   *
   * So the search is confined to rules whose selector mentions a table. Any selector, because a
   * module may legitimately set the property on `.table`, `.tableScroll` or its own `.dataTable` —
   * narrowing to `.table` exactly would swap a false pass for a false failure.
   */
  const tableRules = [...code.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .filter(([, selector]) => /table/i.test(selector))
    .map(([, , body]) => body)
    .join("\n");

  return [...tableRules.matchAll(/(?<!\()\b(?:min-width|--ward-table-min-width)\s*:\s*([0-9.]+rem)\s*;/g)].map(
    (m) => m[1],
  );
}

describe("every ward table keeps the scroll threshold it was built with", () => {
  it("still has every pinned stylesheet on disk", () => {
    /*
     * Anti-vacuity on the DENOMINATOR, not the findings. A guard whose population came out empty —
     * a moved directory, a renamed module — would pass every assertion below over nothing and read
     * exactly like an estate with no problems. Ward Builder Three's sweep had the mirror-image of
     * this bug: its floor asked "did I find components", the answer was yes, and it had still
     * stopped one import level short.
     */
    const present = walk(WARD_DIR).map((file) => file.split("\\").join("/"));
    for (const relative of Object.keys(PINNED)) {
      expect(
        present,
        `${relative} is pinned here but is not on disk — if it moved, move this entry with it ` +
          "rather than removing it",
      ).toContain(`${WARD_DIR}/${relative}`);
    }
    // A FLOOR, NOT AN EQUALITY. It was `toBe(6)` and went red when a seventh ward table was
    // pinned at `120855dea` - an assertion that fires on the estate GROWING, which is the one
    // direction that needs no guarding. The property worth holding is that entries are never
    // quietly DROPPED, so a new table can be pinned without editing this line, and removing one
    // still goes red.
    expect(Object.keys(PINNED).length, "the pinned set has shrunk").toBeGreaterThanOrEqual(7);
  });

  /**
   * 🔴 **THE MAP PROVED THE LISTED FILES WERE RIGHT AND SAID NOTHING ABOUT WHETHER THE LIST WAS
   * COMPLETE — AND IT WAS NOT.** Every assertion above iterates `Object.keys(PINNED)`, so a
   * stylesheet declaring a table threshold that nobody added to the map is invisible here. Swept
   * from disk on 2026-09-05, **nine table thresholds existed in this estate and eight were pinned.**
   * The ninth is `ward-management-modes.module.css`'s `.dataTable` at 48rem.
   *
   * ⚠️ **THIS FILE'S OWN COMMENT PREDICTED IT AND THAT DID NOT PREVENT IT.** Twelve lines above, on
   * the seventh entry: *"an unpinned seventh table would make a six-entry map read as 'these are the
   * ward tables' when there are seven."* The worry was written down, correctly, and then a ninth
   * arrived and nothing went red — because **a worry in a comment is not a check.** The list looked
   * exhaustive, every assertion over it passed, and the one thing nobody was asked was whether the
   * list was the estate.
   *
   * So the population is now DISCOVERED rather than declared: every ward stylesheet is read, every
   * rule whose selector mentions a table and whose body sets a rem threshold is collected, and the
   * map must account for the file it lives in. **A new table cannot be added silently; it either
   * gets a pin or this goes red naming it.**
   */
  it("pins every stylesheet in the estate that declares a table threshold, not just the listed ones", () => {
    const declaring: string[] = [];
    for (const file of walk(WARD_DIR)) {
      if (!file.endsWith(".module.css")) continue;
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
      const hasTableThreshold = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].some(
        ([, selector, body]) =>
          /[Tt]able/u.test(selector) && /(?:--ward-table-min-width|min-width)\s*:\s*[0-9.]+rem\s*;/u.test(body),
      );
      if (hasTableThreshold) declaring.push(file.split("\\").join("/").slice(`${WARD_DIR}/`.length));
    }
    // The floor is on the sweep, never on the misses: a walk that found no thresholds at all would
    // report a perfectly pinned estate.
    expect(declaring.length, "no ward stylesheet declares a table threshold — the sweep found nothing").toBeGreaterThan(
      5,
    );
    const unpinned = declaring.filter((relative) => !(relative in PINNED));
    expect(
      unpinned,
      "a ward stylesheet declares a table scroll threshold that this map does not pin, so nothing " +
        "here would notice it changing, going inert, or being measured against a table that has " +
        "since gained or lost a column",
    ).toEqual([]);
  });

  it("carries each pinned threshold, however it is now spelled", () => {
    const wrong: string[] = [];
    for (const [relative, expected] of Object.entries(PINNED)) {
      const css = readFileSync(`${WARD_DIR}/${relative}`, "utf8");
      const found = thresholds(css);
      if (expected === null) continue;
      // Every pinned value must be present — an array is a file with more than one table, and
      // finding only one of them is exactly the half-pinned state this shape exists to prevent.
      const wanted = typeof expected === "string" ? [expected] : expected;
      const absent = wanted.filter((value) => !found.includes(value));
      if (absent.length > 0) {
        wrong.push(
          `${relative}: expected ${wanted.join(" and ")} table threshold(s), missing ${absent.join(", ")}, found ${found.length > 0 ? found.join(", ") : "none"}`,
        );
      }
    }
    expect(
      wrong,
      "a ward table has lost or changed its scroll threshold. If a module was migrated onto " +
        "ward-table.module.css, it must set --ward-table-min-width to the value it used to " +
        "declare directly — the shared block defaults to 0, so an unset property means the table " +
        "squashes instead of scrolling, and nothing else in this repository would notice.\n" +
        wrong.join("\n"),
    ).toEqual([]);
  });

  it("does not silently give handover a threshold it never had", () => {
    /*
     * The one module with no threshold, asserted as an absence so the extraction cannot hand it one
     * as a side effect of sharing a block. Its table is also the only one of the six with no scroll
     * wrapper, and its module carries `overflow-x: hidden`, which clips rather than scrolls —
     * whether that visibly clips depends on column count and viewport and NOBODY HAS MEASURED IT.
     * So this pins today's behaviour rather than blessing it: an intentional change here should go
     * red and be argued, not arrive with a migration.
     */
    const css = readFileSync(`${WARD_DIR}/handover/handover.module.css`, "utf8");
    expect(
      thresholds(css),
      "handover has acquired a table scroll threshold. That may well be right — its table is " +
        "unwrapped and its module clips rather than scrolls — but it is a change to a screen's " +
        "behaviour and wants its own reason, not a migration's side effect.",
    ).toEqual([]);
  });
});
