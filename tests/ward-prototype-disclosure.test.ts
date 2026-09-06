import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **EVERY WARD SCREEN MUST SAY ITS DATA IS INVENTED, AND THREE OF THEM DID NOT.**
 *
 * Found 2026-09-06 by walking the running app rather than by reading code. `/mockups/ward-flow/capacity`
 * showed 303 beds, 43 waiting patients and twenty-three named Perth hospitals with **nothing on the
 * page saying any of it is fictional**; `/mockups/ward-flow/movements` showed fifty patient journeys
 * with the same silence. Twenty-four other ward screens carried the badge.
 *
 * ⚠️ **THE CAUSE IS THAT IT IS OPT-IN PER SCREEN.** There is no shared component and no layout
 * providing it — every screen renders its own `<span className={styles.prototypeBadge}>`. So a
 * screen built after the convention was set gets none by default, and **the three that were missing
 * it are exactly the three screens the 2026-09-05 merges created** — capacity, delays and movements.
 * Nothing reported it, because nothing asked.
 *
 * ⚠️ **I REPORTED THE WRONG SET TWICE BEFORE THIS, IN OPPOSITE DIRECTIONS.** First I grepped the
 * rendered pages for "not a real medical device" and got SIX missing — a phrase only one screen
 * uses, so four were false. Then I grepped for "Synthetic prototype" and got TWO — because Next
 * streams the page's `<meta name="description">` into the BODY, and three of those descriptions
 * contain the phrase, so `/delays` looked disclosed while showing nothing. **Both sweeps searched
 * the page source; neither measured what a reader sees.** Settled by parsing the document, deleting
 * head/meta/script/title, and reading the remaining text — which agrees with this guard exactly.
 * That is why this scans for the MECHANISM rather than for any phrase.
 *
 * This walks routes rather than components on purpose: a component nothing routes to cannot show a
 * disclosure to anybody, and a route is what a reader actually opens.
 *
 * ⚠️ **NO FOCUSED RUN CAN EVER SELECT THIS FILE, SO DO NOT TRUST ONE OVER IT.** `npm run
 * test:focused` selects by `vitest related`, which walks the IMPORT GRAPH — and this file imports
 * `node:fs` and `vitest`, nothing else. Adding a ward screen with no disclosure therefore changes
 * no file this guard imports, and a focused run over that change reports green having never loaded
 * it. **The same is true of `ward-nav.test.ts` and `ward-mode-workspace-reachability.test.ts`**, the
 * other two guards on this branch that read the repository rather than importing it.
 *
 * **That is not hypothetical here.** On 2026-09-06 a change on this branch added a third builder of
 * the `/ward/[unitId]` route; the delays, capacity, landmarks and route-binding suites were all run
 * and all green, and `ward-nav.test.ts` — which no run had selected — sat red for three commits.
 *
 * Making this file import a component to get itself selected would be worse than the gap: it would
 * tie a whole-repository walk to whichever one component it happened to import, and `related` would
 * still miss every change to the other twenty-odd. **The honest mitigation is a full run before a
 * fold, which matters more here than in most of the repository because this branch never reaches
 * CI — a local `vitest run --dir tests` is the ONLY thing that ever executes this guard.**
 */

const ROUTES_DIR = "src/app/mockups/ward-flow";
const COMPONENTS_DIR = "src/components/ward-management";

/** Mirrors `componentRenderedBy` in `ward-route-component-binding.test.ts` — the same question, so
 *  deliberately the same reading, rather than a second dialect of it. */
function componentRenderedBy(source: string): string | null {
  const body = source.slice(source.indexOf("export default"));
  if (body === "") return null;
  const jsx = /<([A-Z][A-Za-z0-9]*)/u.exec(body);
  if (jsx) return jsx[1];
  const redirected = /\bredirect\(\s*["'`]([^"'`]+)/u.exec(body);
  return redirected ? `redirect:${redirected[1]}` : null;
}

function filesUnder(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name), keep) : keep(entry.name) ? [join(dir, entry.name)] : [],
  );
}

function routeOf(file: string): string {
  const relative = file
    .replace(/\\/gu, "/")
    .slice(`${ROUTES_DIR}/`.length)
    .replace(/\/?page\.tsx$/u, "");
  return relative === "" ? "/" : relative;
}

/**
 * 🔴 **COMMENTS ARE REMOVED BEFORE ANY QUESTION IS ASKED OF A FILE, AND WITHOUT THIS THE GUARD WAS
 * DECIDED BY THE WORDING OF A COMMENT RATHER THAN BY WHAT THE SCREEN RENDERS.**
 *
 * Proved on the live tree, 2026-09-06, by deleting the badge from `capacity-screen.tsx` twice:
 *
 *     badge removed, comment left saying "the prototypeBadge span was removed here"  -> 2 PASSED
 *     badge removed, comment saying "the synthetic-data badge span was removed here" -> 1 FAILED,
 *                                                                 naming capacity -> CapacityScreen
 *
 * Identical code, identical missing disclosure on a page showing 303 beds and twenty-three named
 * Perth hospitals; the verdict turned on whether a comment happened to contain the class name. And
 * it is not hypothetical: `statistics/statistics-disclaimers.tsx` already mentions `prototypeBadge`
 * in prose and nowhere in code, so the satisfying text is in the tree today.
 *
 * ⚠️ **IT FIXES A SECOND HOLE OF THE SAME SHAPE THAT NOBODY HAD LOOKED FOR.** `disclosesWithin`
 * finds a component's children by scanning for `<Tag`, so a COMMENTED-OUT child element counted as
 * rendered — a route could inherit its disclosure from a component it no longer draws.
 */
export function stripComments(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "block" | "line" = "code";
  while (index < source.length) {
    const here = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (here === "/" && next === "*") {
        state = "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (here === "/" && next === "/") {
        state = "line";
        out += "  ";
        index += 2;
        continue;
      }
      out += here;
      index += 1;
      continue;
    }
    if (state === "block") {
      if (here === "*" && next === "/") {
        state = "code";
        out += "  ";
        index += 2;
        continue;
      }
      out += here === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (here === "\n") {
      state = "code";
      out += "\n";
      index += 1;
      continue;
    }
    out += " ";
    index += 1;
  }
  return out;
}

const componentSources = filesUnder(COMPONENTS_DIR, (name) => name.endsWith(".tsx")).map((path) => ({
  path,
  source: stripComments(readFileSync(path, "utf8")),
}));

/** The file that exports `name`, or null. A component nothing exports cannot be checked. */
function sourceOf(name: string): string | null {
  const declaration = new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\b`, "u");
  const found = componentSources.find((candidate) => declaration.test(candidate.source));
  return found ? found.source : null;
}

const DISCLOSURE = /prototypeBadge/u;

/**
 * ⚠️ **THIS FOLLOWS COMPOSITION, AND THE FIRST VERSION DID NOT — IT REPORTED FOUR FALSE
 * POSITIVES.** The four statistics routes render a screen that delegates its page chrome to
 * `statistics-section-frame.tsx`, which carries the badge. Checking only the routed component's own
 * source called all four undisclosed while the rendered page plainly shows the badge.
 *
 * **A guard that names four innocent screens is a guard somebody deletes**, and it would have taken
 * the three real findings with it. So the question asked is the one that matters — does the tree
 * this route renders disclose anywhere — rather than the one that was easy to ask.
 *
 * Depth is bounded and visits are recorded: a component graph with a cycle would otherwise hang,
 * and a hanging guard is indistinguishable from a slow one until somebody kills the run.
 */
function disclosesWithin(name: string, seen: Set<string>, depth = 0): boolean {
  if (depth > 3 || seen.has(name)) return false;
  seen.add(name);
  const source = sourceOf(name);
  if (source === null) return false;
  if (DISCLOSURE.test(source)) return true;
  // Every component this one renders, by JSX tag — the same reading `componentRenderedBy` uses,
  // widened from the first tag to all of them.
  const rendered = new Set(Array.from(source.matchAll(/<([A-Z][A-Za-z0-9]*)/gu), (match) => match[1]));
  return Array.from(rendered).some((child) => disclosesWithin(child, seen, depth + 1));
}

describe("every ward route a reader can open says its data is synthetic", () => {
  const routes = filesUnder(ROUTES_DIR, (name) => name === "page.tsx").map((file) => ({
    route: routeOf(file),
    // Stripped for the same reason the component sources are: a commented-out `export default`
    // or a commented-out JSX tag in a route file would otherwise name a component this route does
    // not render.
    renders: componentRenderedBy(stripComments(readFileSync(file, "utf8"))),
  }));

  it("walks the ward routes at all, so the assertion below is not vacuous", () => {
    /*
     * ⚠️ The floor is on the ROUTES WALKED, never on the failures. A floor on the findings goes red
     * the moment somebody does the right thing and fixes them all, which teaches the next person to
     * delete the guard.
     */
    expect(routes.length, "no ward routes found — the walk is measuring nothing").toBeGreaterThan(20);
    const screens = routes.filter((entry) => entry.renders !== null && !entry.renders.startsWith("redirect:"));
    expect(screens.length, "every ward route resolved to a redirect — no screen is being checked").toBeGreaterThan(15);
  });

  it("cannot be satisfied by a comment naming the badge, and still sees a real one", () => {
    /*
     * ⚠️ **BOTH DIRECTIONS, RUN ON EVERY PASS, AND WRITTEN IN THE EXACT FORM THE SCAN MATCHES.**
     * The failing direction is the one that matters — a guard a comment can satisfy certifies a
     * screen that shows invented clinical figures with nothing saying so — but asserting only that
     * would pass on a stripper that deleted everything, which would report every screen as
     * undisclosed and get the guard deleted instead.
     */
    const commented = [
      "export default function Fake() {",
      "  /* the prototypeBadge span was removed here while this note stayed behind */",
      "  // prototypeBadge",
      "  return null;",
      "}",
    ].join("\n");
    expect(
      DISCLOSURE.test(stripComments(commented)),
      "a comment naming the badge satisfies this guard again — a screen can lose its disclosure and stay green",
    ).toBe(false);

    const real = [
      "export default function Real() {",
      "  return <span className={styles.prototypeBadge}>x</span>;",
      "}",
    ].join("\n");
    expect(
      DISCLOSURE.test(stripComments(real)),
      "a real badge is no longer seen — every screen would report as undisclosed and this guard would be deleted",
    ).toBe(true);
  });

  it("renders a synthetic-data disclosure on every routed screen", () => {
    const missing: string[] = [];
    const unresolved: string[] = [];

    for (const { route, renders } of routes) {
      // A redirect renders no content of its own; the screen it lands on is checked on its own row.
      if (renders === null || renders.startsWith("redirect:")) continue;
      if (sourceOf(renders) === null) {
        unresolved.push(`${route} -> ${renders}`);
        continue;
      }
      if (!disclosesWithin(renders, new Set())) missing.push(`${route} -> ${renders}`);
    }

    /*
     * An unresolvable component is reported rather than skipped. Silently passing a route whose
     * component could not be read is how a guard comes to check fewer things than it appears to.
     */
    expect(unresolved, "these routes render a component this guard could not locate, so they went unchecked").toEqual(
      [],
    );

    expect(
      missing,
      "these ward screens show invented bed counts, patient journeys and named hospitals with nothing " +
        "on the page saying the data is fictional. The convention is a `prototypeBadge` in a " +
        "governance banner, carried by every other ward screen — it is opt-in, so a new screen gets " +
        "none by default.",
    ).toEqual([]);
  });
});
