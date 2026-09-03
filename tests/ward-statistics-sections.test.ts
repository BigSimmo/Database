// tests/ward-statistics-sections.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  edStatisticsHref,
  statisticsSectionById,
  wardStatisticsHref,
  STATISTICS_COMPARE_HREF,
  STATISTICS_HOME_HREF,
  STATISTICS_OVERVIEW_HREF,
  STATISTICS_SECTIONS,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_UNIT_CHOOSER_ID,
} from "../src/components/ward-management/statistics/statistics-sections";

/**
 * THE SECTION LIST, AND THE ROUTES IT CLAIMS EXIST.
 *
 * ⚠️ **What only this file can prove.** `statistics-sections.ts` is the single place the sections
 * are named, so every screen and the hub index agree with each other by construction — they read
 * the same array. What they cannot prove between them is that the array describes REALITY: a
 * section whose `href` names a route nobody built would be rendered identically by the hub, agreed
 * with by every screen, and dead on click. So the checks below resolve each href against the file
 * system rather than against another constant.
 *
 * ⚠️ **No expectation here is computed from the module under test.** Each route path is written out
 * as a literal, because a test that rebuilds the href with the same helper the source uses agrees
 * with any value the helper produces, including a wrong one.
 */

const APP_ROOT = join(process.cwd(), "src", "app");

/** The `page.tsx` a route path corresponds to, as a real path on disk. */
function routeFile(routePath: string): string {
  return join(APP_ROOT, ...routePath.replace(/^\//, "").split("/"), "page.tsx");
}

describe("the statistics section list", () => {
  /**
   * The zero-match guard. Every check below iterates the list, so an empty list would pass all of
   * them by scanning nothing — the same failure shape `ward-flow-single-source.test.ts` guards its
   * own walks against.
   */
  it("names three sections, and they are the three the owner asked for", () => {
    expect(STATISTICS_SECTIONS.map((section) => section.id)).toEqual(["overview", "compare", "units"]);
  });

  it("gives every section a label and a one-line description", () => {
    for (const section of STATISTICS_SECTIONS) {
      expect(section.label.trim().length).toBeGreaterThan(0);
      expect(section.description.trim().length).toBeGreaterThan(0);
      // A description is a sentence, not a paragraph: it has to fit a hub index card.
      expect(section.description).not.toContain("\n");
    }
  });

  it("gives every section a distinct id, label, description and href", () => {
    const fields = ["id", "label", "description", "href"] as const;
    for (const field of fields) {
      const values = STATISTICS_SECTIONS.map((section) => section[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  /**
   * ⚠️ **THE NO-INVENTED-FIGURES RULE, APPLIED TO THE ONE PLACE A FIGURE COULD BE FROZEN.** A count
   * written into a label or a description ("Figures across four services", "Nine wards compared")
   * stops being true silently the day the network changes, and nothing renders differently. The
   * sections describe what a page is FOR; the pages state quantities, or state that they cannot.
   */
  it("puts no numeral in any section label or description", () => {
    for (const section of STATISTICS_SECTIONS) {
      expect(section.label).not.toMatch(/[0-9]/);
      expect(section.description).not.toMatch(/[0-9]/);
    }
  });

  it("keeps every section under the statistics hub", () => {
    for (const section of STATISTICS_SECTIONS) {
      expect(section.href.startsWith(`${STATISTICS_HOME_HREF}/`)).toBe(true);
    }
  });
});

describe("the section hrefs resolve to routes that exist", () => {
  it("puts the hub, the overview and the comparisons hrefs at the routes this plan built", () => {
    expect(STATISTICS_HOME_HREF).toBe("/mockups/ward-flow/statistics");
    expect(STATISTICS_OVERVIEW_HREF).toBe("/mockups/ward-flow/statistics/overview");
    expect(STATISTICS_COMPARE_HREF).toBe("/mockups/ward-flow/statistics/compare");
  });

  it("has a page.tsx on disk for the hub and for both static section routes", () => {
    for (const routePath of [STATISTICS_HOME_HREF, STATISTICS_OVERVIEW_HREF, STATISTICS_COMPARE_HREF]) {
      expect({ routePath, exists: existsSync(routeFile(routePath)) }).toEqual({ routePath, exists: true });
    }
  });

  it("has a page.tsx on disk for both per-unit dynamic routes", () => {
    for (const routePath of [
      "/mockups/ward-flow/statistics/ward/[unitId]",
      "/mockups/ward-flow/statistics/ed/[edId]",
    ]) {
      expect({ routePath, exists: existsSync(routeFile(routePath)) }).toEqual({ routePath, exists: true });
    }
  });

  /**
   * The third section has no page of its own — per-unit detail is served by two dynamic routes, so
   * it is reached by choosing a unit. Its href therefore points at the comparisons page's chooser
   * anchor, and this check is what stops that arrangement being "tidied" into an href for a route
   * that does not exist.
   */
  it("sends the per-unit section to the chooser on the comparisons page", () => {
    const perUnit = statisticsSectionById("units");
    // A literal, not `${STATISTICS_COMPARE_HREF}#${STATISTICS_UNIT_CHOOSER_ID}` — an expectation
    // rebuilt from the same constants the source composes agrees with any value they produce.
    expect(perUnit?.href).toBe("/mockups/ward-flow/statistics/compare#choose-a-unit");
    expect(perUnit?.href).toBe(STATISTICS_UNIT_CHOOSER_HREF);
    expect(STATISTICS_UNIT_CHOOSER_ID).toBe("choose-a-unit");
    expect(existsSync(routeFile(STATISTICS_COMPARE_HREF))).toBe(true);
  });
});

/**
 * ⚠️ **A SOURCE-TEXT ASSERTION, AND IT IS THE POINT RATHER THAN A SHORTCUT.**
 *
 * `tests/ward-nav.test.ts` proves a dynamic route is reachable by scanning `src` for a LITERAL
 * route path. Fix round 1: both per-unit routes were built as an interpolation of
 * `STATISTICS_HOME_HREF`, so the scan found no literal and reported that nothing anywhere could
 * reach either of them — the same state the board route shipped in. The builders now write the
 * whole path out, which knowingly duplicates the home-href prefix.
 *
 * A behavioural assertion cannot protect that: `wardStatisticsHref("x")` returns the identical
 * string either way, so a refactor back to the variable would pass every other test in this file
 * while silently unreaching two pages. The only thing that can fail is a check on the source text
 * itself — and it belongs here, in a file this task owns, rather than only in `ward-nav.test.ts`,
 * which it may not edit.
 */
describe("the per-unit route paths are written as literals, for the route scan", () => {
  const SECTIONS_SOURCE = readFileSync(
    join(process.cwd(), "src", "components", "ward-management", "statistics", "statistics-sections.ts"),
    "utf8",
  );

  it("contains both whole route paths as literal text", () => {
    expect(SECTIONS_SOURCE).toContain("`/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`");
    expect(SECTIONS_SOURCE).toContain("`/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`");
  });

  it("never rebuilds either path from the home-href constant", () => {
    // Anywhere in the file, comments included — a comment demonstrating the old form would read as
    // a literal to a scanner too, and would make this guard argue with itself.
    expect(SECTIONS_SOURCE).not.toContain("${STATISTICS_HOME_HREF}/ward");
    expect(SECTIONS_SOURCE).not.toContain("${STATISTICS_HOME_HREF}/ed");
  });

  /** The literal and the function must not be able to disagree — a typo in one is the whole risk. */
  it("returns exactly the path the literal spells", () => {
    expect(wardStatisticsHref("a-ward")).toBe("/mockups/ward-flow/statistics/ward/a-ward");
    expect(edStatisticsHref("an-ed")).toBe("/mockups/ward-flow/statistics/ed/an-ed");
    expect(existsSync(routeFile("/mockups/ward-flow/statistics/ward/[unitId]"))).toBe(true);
    expect(existsSync(routeFile("/mockups/ward-flow/statistics/ed/[edId]"))).toBe(true);
  });
});

describe("statisticsSectionById", () => {
  it("returns the section asked for", () => {
    expect(statisticsSectionById("compare")?.label).toBe("Ward and ED comparisons");
  });

  /** Never falls back to a different section — the same discipline `unitById` and `edById` hold. */
  it("returns undefined for an id it does not have", () => {
    expect(statisticsSectionById("overwiew")).toBeUndefined();
    expect(statisticsSectionById("")).toBeUndefined();
  });
});

describe("the per-unit href builders", () => {
  it("builds the ward and department detail routes", () => {
    expect(wardStatisticsHref("rph-adult-secure")).toBe("/mockups/ward-flow/statistics/ward/rph-adult-secure");
    expect(edStatisticsHref("peel-ed")).toBe("/mockups/ward-flow/statistics/ed/peel-ed");
  });

  /**
   * ⚠️ The encode/decode pair, checked as a pair. The routes `decodeURIComponent` on the way in, so
   * a builder that did not encode would produce a link resolving to a different id — and today's
   * ids are plain slugs, which is exactly why nobody would notice. The round trip is asserted with
   * an id that actually needs escaping.
   */
  it("encodes an id that needs escaping, so the route's decode returns the id it started with", () => {
    const awkward = "ward with spaces/and-a-slash?";
    const wardTail = wardStatisticsHref(awkward).replace("/mockups/ward-flow/statistics/ward/", "");
    const edTail = edStatisticsHref(awkward).replace("/mockups/ward-flow/statistics/ed/", "");

    expect(wardTail).not.toContain("/");
    expect(edTail).not.toContain("/");
    expect(decodeURIComponent(wardTail)).toBe(awkward);
    expect(decodeURIComponent(edTail)).toBe(awkward);
  });
});

/**
 * ⚠️ **THE ONE SENTENCE ON THE WARD SCREEN THAT IS A LIVE MEASUREMENT RATHER THAN A STANDING
 * TRUTH.** `statistics-ward-screen.tsx` tells the reader that `wardStatistics()` "has no consumer
 * in the app — only its own test", and uses that to say how near a ward's figures are. It is true
 * today and pinned by nothing, and the FIRST SCREEN TO RENDER A WARD FIGURE FALSIFIES IT — which is
 * this page's own next step, so the falsification is not hypothetical.
 *
 * This walk is the pin. The day a module under `src` imports `ward-statistics`, this goes red and
 * the sentence must be rewritten, rather than sitting on the page being confidently wrong about a
 * fact the reader has no way to check.
 */
describe("the ward screen's claim that wardStatistics has no consumer in the app", () => {
  const SRC_ROOT = join(process.cwd(), "src");

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
    );
  }

  it("finds no module under src importing ward-statistics", () => {
    const sources = walk(SRC_ROOT).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

    // The zero-match guard: a mistyped root would scan nothing and pass by finding nothing.
    expect(sources.length).toBeGreaterThan(100);

    // Matches the module by its own path segment, and only as an import specifier, so
    // `ward-statistics-sections` and this feature's own `statistics/` directory are not mistaken
    // for it. Written without a word boundary escape on purpose: a literal backslash-b in a test
    // regex becomes a backspace byte and silently matches nothing while printing as valid.
    const importers = sources.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes('ward-management/ward-statistics"') || source.includes("ward-management/ward-statistics'");
    });

    expect(importers).toEqual([]);
  });
});

/**
 * ⚠️ **THE REACHABILITY SCAN READS SOURCE TEXT, SO A COMPOSED ROUTE PATH IS INVISIBLE TO IT** —
 * however correct the string it produces. Until 2026-09-01 the overview and comparisons constants
 * were built as `${STATISTICS_HOME_HREF}/…`, and on that day neither full path appeared anywhere in
 * `src`. Two real, linked, working routes were unseeable by the scan and nothing went red.
 *
 * This asserts the property the scan actually needs — the literal path present in source text —
 * rather than the value the constant happens to hold, which a composed expression satisfies just as
 * well. That distinction is the entire point: a `toBe` on the constant passes either way.
 *
 * Ward Lead is building a repository-wide invariant that walks every route directory under
 * `src/app/mockups/ward-flow` and makes this check for all of them. This is the same rule, applied
 * by hand to this module ahead of it.
 */
describe("every statistics route path is written as a literal, where the scan can see it", () => {
  const SECTIONS_SOURCE = readFileSync(
    join(process.cwd(), "src", "components", "ward-management", "statistics", "statistics-sections.ts"),
    "utf8",
  );

  it("carries each route path as literal source text rather than composing it", () => {
    // Not vacuous: an unreadable or empty file would satisfy nothing below for the wrong reason.
    expect(SECTIONS_SOURCE.length).toBeGreaterThan(1000);

    // The declaration lines themselves, not merely the path appearing somewhere in the file: a
    // route path quoted in a doc comment is source text too, and would satisfy a looser check while
    // the constant beside it went back to being composed.
    for (const declaration of [
      'export const STATISTICS_HOME_HREF = "/mockups/ward-flow/statistics";',
      'export const STATISTICS_OVERVIEW_HREF = "/mockups/ward-flow/statistics/overview";',
      'export const STATISTICS_COMPARE_HREF = "/mockups/ward-flow/statistics/compare";',
    ]) {
      expect(SECTIONS_SOURCE).toContain(declaration);
    }

    // The two dynamic builders and the chooser write their path into the template literal itself.
    expect(SECTIONS_SOURCE).toContain("`/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`");
    expect(SECTIONS_SOURCE).toContain("`/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`");
    expect(SECTIONS_SOURCE).toContain("`/mockups/ward-flow/statistics/compare#${STATISTICS_UNIT_CHOOSER_ID}`");

    // And the composition that hid two of them may not come back.
    expect(SECTIONS_SOURCE).not.toContain("${STATISTICS_HOME_HREF}/");
    expect(SECTIONS_SOURCE).not.toContain("${STATISTICS_COMPARE_HREF}");
  });
});

/**
 * ⚠️ **THE FALSE SENTENCES THIS SURFACE CARRIED IN ITS COMMENTS, PINNED AS ABSENCES.** A comment is
 * read by a developer rather than by a clinician, which makes it less urgent and not less false —
 * and three of the four repaired here were the same defect: an unearned "every", or a count typed
 * into prose that nothing re-checks.
 *
 * ⚠️ **EVERY ONE OF THESE IS PINNED IN BOTH DIRECTIONS.** A negative alone is satisfied by deleting
 * the paragraph, which loses the argument the paragraph was making; a positive alone is satisfied by
 * a file that says the new thing and the old thing at once. So each check names the retired wording
 * AND the replacement, and where the underlying fact can be measured rather than asserted — the CSS
 * class counts — it is measured from disk here rather than restated.
 *
 * ⚠️ **THE NEGATIVES SCAN THE WHOLE FILE, WHICH MEANS A HISTORY NOTE MAY NOT QUOTE THE RETIRED
 * SENTENCE BACK WORD FOR WORD.** That is deliberate and it fired during this repair: two correction
 * notes quoted the false sentences verbatim and tripped their own guards. A scan cannot tell a
 * quotation from a relapse, and the alternative — carving an exemption around whatever a comment
 * calls its history section — is a guard that any future false sentence can walk through by sitting
 * in the exempt region. So the notes describe what the retired wording said instead of reprinting
 * it, and say so where they do it.
 */
describe("the corrected comment claims on the statistics surface", () => {
  const STATISTICS_DIR = join(process.cwd(), "src", "components", "ward-management", "statistics");
  const WARD_MANAGEMENT_DIR = join(process.cwd(), "src", "components", "ward-management");

  function statisticsSource(fileName: string): string {
    const source = readFileSync(join(STATISTICS_DIR, fileName), "utf8");
    // Not vacuous: an unreadable or truncated file would satisfy every negative below for the
    // wrong reason, which is the failure mode of an absence assertion.
    expect(source.length, `${fileName} is too short to be the real file`).toBeGreaterThan(2000);
    return source;
  }

  /** Every CSS module under `src/components/ward-management/`, walked rather than listed. */
  function cssModules(directory: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) found.push(...cssModules(path));
      else if (entry.name.endsWith(".module.css")) found.push(path);
    }
    return found;
  }

  /**
   * ⚠️ **THE COUNT AND THE THIRD CLASS NAME WERE BOTH FALSE, AND THE COUNT WAS WRITTEN TWICE IN TWO
   * DIFFERENT VALUES.** `statistics-disclaimers.tsx` said "every one of the eighteen ward modules
   * declares `.governanceBanner`, `.prototypeBadge` and `.notice` on its own root";
   * `statistics-section-frame.tsx` said "the other seventeen ward modules" for the same set. Most of
   * the modules that declare the first two carry no `.notice` rule at all, which the measurement
   * below establishes from disk rather than by assertion — so the "every one of" was false of the
   * very set it was counting.
   *
   * No count replaces them. A count typed into a comment is a claim nothing re-checks, which is what
   * `statistics-sections.ts`'s own header says and what happened here.
   */
  it("no longer claims every ward module declares all three governance classes", () => {
    const modules = cssModules(WARD_MANAGEMENT_DIR);
    expect(modules.length, "the CSS module walk found nothing, so nothing below is measured").toBeGreaterThan(10);

    const declares = (source: string, className: string) => new RegExp(`^\\s*\\.${className}\\b`, "m").test(source);

    const withBannerAndBadge = modules.filter((path) => {
      const source = readFileSync(path, "utf8");
      return declares(source, "governanceBanner") && declares(source, "prototypeBadge");
    });
    const alsoWithNotice = withBannerAndBadge.filter((path) => declares(readFileSync(path, "utf8"), "notice"));

    // The pair really is the per-module pattern the comments argue from...
    expect(withBannerAndBadge.length).toBeGreaterThan(5);
    // ...and `.notice` really is not, which is the fact the retired sentence got wrong. Stated as a
    // strict inequality rather than as a number, so a module gaining or losing `.notice` cannot
    // falsify a figure typed into a test either.
    expect(
      alsoWithNotice.length,
      "every module declaring the banner pair now declares `.notice` too, so the retired sentence would be true " +
        "again and this guard has stopped meaning anything — re-read it rather than deleting it.",
    ).toBeLessThan(withBannerAndBadge.length);

    const disclaimers = statisticsSource("statistics-disclaimers.tsx");
    const frame = statisticsSource("statistics-section-frame.tsx");

    for (const [fileName, source] of [
      ["statistics-disclaimers.tsx", disclaimers],
      ["statistics-section-frame.tsx", frame],
    ] as const) {
      // The retired wording, forbidden by name. A spelled-out count of the modules is the exact form
      // the defect took, in two different values in two files.
      for (const retired of ["eighteen ward", "seventeen ward", "nineteenth module"]) {
        expect(source, `${fileName} has gone back to counting the ward modules: "${retired}"`).not.toContain(retired);
      }
      expect(source, `${fileName} has restored \`.notice\` to the list of classes every module declares`).not.toContain(
        "`.governanceBanner`, `.prototypeBadge` and `.notice` on its own root",
      );
    }

    // And the argument the paragraph exists to make is still there, on the pair that really is
    // per-module. A negative alone would be satisfied by deleting it.
    expect(disclaimers).toContain("declares `.governanceBanner` and `.prototypeBadge` on its own root");
  });

  /**
   * ⚠️ **THE DELETED REACHABILITY SENTENCE, FORBIDDEN IN SOURCE AS WELL AS ON SCREEN.** The rendered
   * half is pinned in `tests/ward-statistics-sections.dom.test.tsx`. This half exists because the
   * screen file also carries the record of WHY the sentence went, and a record that quoted it back
   * word for word would put the retired wording into the tree in a form no scan can tell from a
   * relapse. So the wording is forbidden outright and the note describes it instead.
   */
  it("carries the retired reachability sentence nowhere in the overview screen's source", () => {
    const overview = readFileSync(join(STATISTICS_DIR, "statistics-overview-screen.tsx"), "utf8");
    expect(overview.length, "the overview screen is too short to be the real file").toBeGreaterThan(2000);

    for (const retired of [
      "no way in from the statistics home page",
      "the index that will link here",
      "is separate work",
    ]) {
      expect(overview, `the retired reachability sentence has returned to source: "${retired}"`).not.toContain(retired);
    }

    // The record of the deletion is still there, so a later reader is not left guessing why the
    // paragraph reads as it does — a negative alone is satisfied by deleting the explanation too.
    expect(overview).toContain("A SENTENCE WAS DELETED FROM THIS PARAGRAPH");
  });

  /**
   * ⚠️ **AN ABSOLUTE STATED OVER A SCOPE THE SENTENCE NEVER NAMED.** The frame's doc comment said
   * "NO CONTROLS. The only interactive element HERE is the link back to the hub", with
   * `<ClinicalRail />` rendered as the frame's own first child: a menu button, an icon rail with an
   * expand handler, a sidebar with a collapse handler and a sheet, one of which mutates persisted UI
   * state. The substantive point — nothing on a section page looks as though it would change a
   * figure — survives once the sentence says which scope it is about.
   */
  it("scopes the no-controls claim to what the frame itself adds", () => {
    const frame = statisticsSource("statistics-section-frame.tsx");

    expect(frame, "the unscoped absolute has returned").not.toContain("**NO CONTROLS.**");
    expect(frame, "the unscoped absolute has returned").not.toContain("The only interactive element here is");

    expect(frame).toContain("**THIS FRAME ADDS NO CONTROLS.**");
    expect(frame).toContain("The only interactive element the frame itself adds is");
    // The rail is named, because an unnamed exception is the same defect one step quieter.
    expect(frame).toContain("ClinicalRail");
    // And the frame really does render it, so the correction is about this file rather than about a
    // component it stopped using.
    expect(frame).toContain("<ClinicalRail />");
  });

  /**
   * ⚠️ **THE REGISTER'S TITLE LINE CLAIMED A COMPLETENESS ITS OWN BODY DENIES.** It opened "every
   * statement the statistics and community screens make about the data model, paired with the line
   * of real source that makes it true" — in the file whose entire subject is that an overstated
   * guarantee is worse than an absent one, and directly above `UNEVIDENCED_CLAIMS`, which is a list
   * of statements deliberately paired with no line at all.
   */
  it("no longer opens the claims register with an unearned every", () => {
    const register = statisticsSource("statistics-claims-register.ts");

    expect(register, "the register's overstated opening line has returned").not.toContain(
      "every statement the statistics and community screens make about the data",
    );
    expect(register).toContain("or listed in");
    expect(register).toContain("`UNEVIDENCED_CLAIMS` with the reason no line can be cited for it");
    // The qualification is only honest if the list it points at is really there and really populated.
    expect(register).toContain("export const UNEVIDENCED_CLAIMS");
  });

  /**
   * ⚠️ **THE SAME UNEARNED QUANTIFIER, IN THE DERIVATION'S OWN WORDS.** `statistics-derivations.ts`
   * said a movement all of whose referrals have come back declined "has USUALLY been put to three
   * wards out of a network of many" — a claim about a distribution nothing measures, with the
   * constant's value typed out beside it as a second copy of a fact `ward-model.ts` owns. The
   * rendered half of this pair is pinned in `tests/ward-statistics.dom.test.tsx`.
   */
  it("states the parallel-referral cap as a ceiling in the derivation comment too", () => {
    const derivations = statisticsSource("statistics-derivations.ts");

    expect(derivations, "the unmeasured distribution claim has returned").not.toContain("has usually been put to");
    expect(derivations, "the cap's value is typed out again beside the constant").not.toContain(
      "can be live at three wards at once",
    );

    // Matched on a fragment that cannot span a comment line break: the doc comment is wrapped by
    // hand and by Prettier, so an assertion long enough to cross a newline fails on a re-wrap and
    // teaches the next person to delete it.
    expect(derivations).toContain("be live at only that many wards at once");
    expect(derivations).toContain("put to AT MOST that many wards");
  });
});

/**
 * ⚠️ **THE ROUTE PAGE'S OWN PROHIBITION NAMED THREE PROPS FOR A SCREEN THAT TAKES FOUR.**
 * `StatisticsScreen` accepts `admissions`, `referrals`, `bedReleases` AND `movements` as optional
 * overrides — all four fall back to `useWardFlow()` — but this route's doc comment listed only the
 * first three and said "all three". A reader trusting the comment would believe passing `movements`
 * here was safe, when it is exactly the same live-state-overriding mistake as the other three.
 *
 * The true count is read from the component's own prop type below, rather than hard-coded here a
 * second time, so a future prop added to `StatisticsScreen` fails this file for the right reason —
 * an outdated prohibition — rather than leaving a silently stale "four" behind.
 */
describe("the statistics route page's prop-passing prohibition names every override prop", () => {
  const ROUTE_PAGE = join(process.cwd(), "src", "app", "mockups", "ward-flow", "statistics", "page.tsx");
  const SCREEN_FILE = join(
    process.cwd(),
    "src",
    "components",
    "ward-management",
    "statistics",
    "statistics-screen.tsx",
  );

  function readRoutePage(): string {
    const source = readFileSync(ROUTE_PAGE, "utf8");
    expect(source.length, `${ROUTE_PAGE} is too short to be the real file`).toBeGreaterThan(500);
    return source;
  }

  it("StatisticsScreen really does take four optional override props, not three", () => {
    const screenSource = readFileSync(SCREEN_FILE, "utf8");
    const signature = screenSource.slice(
      screenSource.indexOf("export function StatisticsScreen"),
      screenSource.indexOf("= {}) {") + "= {}) {".length,
    );
    // Each prop name must appear exactly once in both the destructuring and the inline type, so
    // this is a count over the whole signature slice rather than a single occurrence check.
    for (const prop of ["admissions", "referrals", "bedReleases", "movements"]) {
      const occurrences = (signature.match(new RegExp(`\\b${prop}\\b`, "g")) ?? []).length;
      expect(occurrences, `${prop} does not appear twice (destructured and typed) in the signature`).toBe(2);
    }
  });

  it("no longer says 'all three' or omits movements from the named props", () => {
    const source = readRoutePage();
    expect(source, "the retired three-prop count has returned").not.toContain("all three");
    expect(source, "the prohibition still enumerates only three props, without movements").not.toContain(
      "`admissions`, `referrals` or `bedReleases`.",
    );
  });

  it("names all four props and says 'all four'", () => {
    const source = readRoutePage();
    expect(source).toContain("`admissions`, `referrals`, `bedReleases` or `movements`");
    expect(source).toContain("all four");
  });
});
