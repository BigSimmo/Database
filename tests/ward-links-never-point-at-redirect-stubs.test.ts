import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 🔴 **A SCREEN LINKED A CLINICIAN AT A ROUTE THE REPOSITORY ITSELF CALLS "NOT A DESTINATION".**
 *
 * Found 2026-09-06 by opening the handover screen. Its closing line read:
 *
 * > This handover answers "what do I need to hand over this shift?" For "what can I fill right now,
 * > across the network?", see the [morning bed state](/mockups/ward-flow/morning).
 *
 * MERGE 02 folded the morning bed state board into `CapacityScreen` the previous day, owner-approved.
 * `/mockups/ward-flow/morning` survives only as a redirect stub so an existing bookmark does not
 * 404, and `ward-nav.ts` says so in as many words: *"not a destination in its own right"*.
 *
 * ⚠️ **IT DOES NOT 404, WHICH IS WHY NOTHING CAUGHT IT.** The link works. A reader clicks "morning
 * bed state" and lands on a screen titled Capacity — so the failure is not a broken link but a
 * screen promising a board that no longer exists under that name, which is the harder thing to
 * notice and the easier thing to believe.
 *
 * ⚠️ **AND THE DISTINCTION THIS GUARD TURNS ON IS NOT "IS IT IN THE UNLISTED MAP".**
 * `WARD_NAV_INTENTIONALLY_UNLISTED` holds two different kinds of route, and only one is a defect to
 * link at:
 *
 *     redirect stubs        /constellation, /queue, /exceptions, /escalation, /morning, /transport
 *                           — retired screens kept so bookmarks do not 404. Never link these.
 *     real destinations     /statistics/overview, /statistics/compare, the add-person form
 *                           — deliberately reached by Link rather than from the rail. Linking is
 *                             how they are reached AT ALL, so a guard over the map would forbid
 *                             the very thing they exist for.
 *
 * So the property is derived from the ROUTE FILES rather than from the map: a route whose
 * `page.tsx` calls `redirect(` is a stub, whatever any registry says about it, and no in-app link
 * may point at one. Both sides of the comparison come off disk, so a new stub is covered the day it
 * is added and a stub promoted back to a real screen stops being covered on the same day.
 */

const ROUTES_ROOT = join(process.cwd(), "src/app/mockups/ward-flow");
const COMPONENTS_ROOT = join(process.cwd(), "src/components/ward-management");

/** Every static ward route whose page is nothing but a redirect. */
function redirectStubRoutes(): string[] {
  const stubs: string[] = [];
  const walk = (dir: string, route: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Dynamic segments cannot be link targets by literal href, so they cannot be stubs here.
        if (entry.name.startsWith("[")) continue;
        walk(path, `${route}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        const source = readFileSync(path, "utf8");
        if (/\bredirect\(/u.test(source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " "))) {
          stubs.push(route);
        }
      }
    }
  };
  walk(ROUTES_ROOT, "/mockups/ward-flow");
  return stubs.sort();
}

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");

function everyWardSourceFile(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(COMPONENTS_ROOT);
  return files;
}

/**
 * 🔴 **HREF CONSTANTS ARE RESOLVED, AND THE FIRST VERSION OF THIS DID NOT DO IT.**
 *
 * Matching only literal `href="/mockups/ward-flow/..."` found NINE links across the whole estate —
 * and the floor below said that could not be right, which is the only reason I looked. Most ward
 * links are written `href={STATISTICS_OVERVIEW_HREF}`, so a stale link written through a constant
 * — the normal way it would be written here — was invisible to the guard. It would have passed
 * clean while missing the majority of its own subject.
 */
function hrefConstants(): Map<string, string> {
  const constants = new Map<string, string>();
  for (const path of everyWardSourceFile()) {
    const source = stripComments(readFileSync(path, "utf8"));
    for (const match of source.matchAll(
      /export const ([A-Z0-9_]+)(?::\s*[^=]+)?\s*=\s*["'`](\/mockups\/ward-flow[^"'`]*)["'`]/gu,
    )) {
      constants.set(match[1], match[2]);
    }
  }
  return constants;
}

/** Every `href` a ward component links to — literal or via a resolved constant. */
function wardLinks(): { file: string; href: string }[] {
  const constants = hrefConstants();
  const found: { file: string; href: string }[] = [];
  for (const path of everyWardSourceFile()) {
    if (!path.endsWith(".tsx")) continue;
    const file = path.split(/[\\/]/u).pop() ?? path;
    const source = stripComments(readFileSync(path, "utf8"));

    for (const match of source.matchAll(/href=\{?["'`](\/mockups\/ward-flow[^"'`{}]*)["'`]/gu)) {
      found.push({ file, href: match[1] });
    }
    for (const match of source.matchAll(/href=\{([A-Z0-9_]+)\}/gu)) {
      const resolved = constants.get(match[1]);
      if (resolved) found.push({ file, href: resolved });
    }
  }
  return found;
}

describe("no ward screen links at a retired route kept only as a redirect", () => {
  it("finds no in-app link pointing at a redirect stub", () => {
    const stubs = redirectStubRoutes();
    const links = wardLinks();

    // Two floors, because either side going empty would produce a clean green over nothing. The
    // first says the stubs are still being found; the second says the links are.
    expect(
      stubs,
      "no ward route is a redirect stub any more. If the merges were undone this guard has no " +
        "subjects; if the walk broke, it has no evidence. Either way it is not testing anything.",
    ).not.toHaveLength(0);
    expect(
      links.length,
      "no ward component links to a ward route at all, which cannot be right — the walk has broken.",
    ).toBeGreaterThan(10);

    const offenders = links
      .filter((link) => stubs.includes(link.href.replace(/[?#].*$/u, "")))
      .map((link) => `${link.file} -> ${link.href}`);

    expect(
      [...new Set(offenders)],
      "a ward screen links a clinician at a route that only exists so old bookmarks do not 404. " +
        "It will not 404 — it will silently land them on a different screen under a name the app no " +
        "longer uses, which is worse. Point the link at the screen that absorbed it, and change the " +
        "link TEXT too: the name is the half the reader believes.",
    ).toEqual([]);
  });
});
