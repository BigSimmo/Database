import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE TRANSPORT PAGE HAS ONE NAME.
 *
 * `HD-Q1`, answered by the owner 2026-08-30: the page is called **Transport**. Until then it had
 * three user-facing names and they all disagreed:
 *
 *   the route            /mockups/ward-flow/transport
 *   the document title   "Live tracker - Ward Flow"
 *   the page heading     <h1 class="sr-only">Live tracker</h1>
 *
 * ⚠️ **THE HEADING IS THE ONE THAT MATTERS MOST AND IS THE EASIEST TO LEAVE BEHIND.** It is
 * `sr-only`, so nobody reviewing the screen visually ever sees it — and it is the page's accessible
 * name, which means for a screen-reader user it is not one name among three, it is **the only one
 * they get.** A sighted reader can reconcile a tab title against a nav label; somebody hearing
 * "Live tracker" announced on a page the nav called Transport has nothing to reconcile it against.
 *
 * The component and its file stay `LiveTracker` / `live-tracker.tsx`. That name is internal, no
 * user meets it, and renaming it would move every import for no reader's benefit — the opposite
 * trade from `/patients/[patientId]`, where the ROUTE lies about what the page shows and a user
 * does meet it.
 */
const PAGE = "src/app/mockups/ward-flow/transport/page.tsx";
const COMPONENT = "src/components/ward-management/tracker/live-tracker.tsx";

describe("the transport page names itself the same way everywhere a user can hear it", () => {
  const page = readFileSync(PAGE, "utf8");
  const component = readFileSync(COMPONENT, "utf8");

  it("reads both files, or every assertion below is about an empty string", () => {
    // The canary. `.not.toContain` on a file that failed to load passes perfectly.
    expect(page.length).toBeGreaterThan(100);
    expect(component.length).toBeGreaterThan(100);
    expect(page).toContain("Metadata");
    expect(component).toContain("sr-only");
  });

  it("titles the document Transport", () => {
    expect(page).toContain('title: "Transport - Ward Flow"');
  });

  it("⚠️ HEADS THE PAGE Transport — the accessible name, and the only one a screen reader gets", () => {
    expect(component).toContain('<h1 className="sr-only">Transport</h1>');
  });

  it("says Live tracker nowhere a user can reach", () => {
    // ⚠️ COMMENTS ARE STRIPPED FIRST, and the first version of this test did not strip them — so it
    // failed on the comment explaining the rename, which says "Live tracker" in order to record what
    // the heading used to be. Same shape as a retraction that quotes the claim it withdraws: the
    // search matched the word and not the thing. A comment is not somewhere a user can reach, and a
    // test that forbids naming the old name in prose would make the history unwritable.
    const reachable = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(
      reachable(page),
      "the old name survives in the page's metadata, which a browser tab and a search result show",
    ).not.toMatch(/Live tracker/);
    expect(
      reachable(component),
      "the old name survives in the component's rendered output — a heading, a subtitle or an " +
        "aria-label, each of which reaches somebody",
    ).not.toMatch(/Live tracker/);
  });

  it("STRIPS ONLY COMMENTS — the stripper must not be eating the code it is meant to search", () => {
    // The canary for the assertion above. A stripper with a greedy or wrong pattern returns
    // something short and harmless, and `.not.toMatch` then passes against nearly nothing.
    const reachable = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const stripped = reachable(component);
    expect(stripped.length, "the stripper removed most of the file").toBeGreaterThan(component.length / 2);
    expect(stripped, "the heading must survive stripping, or the search above sees nothing").toContain(
      '<h1 className="sr-only">Transport</h1>',
    );
  });

  it("keeps the INTERNAL name, so this file is about user-facing names and not a rename sweep", () => {
    // Stated positively. Without it, a future reader satisfies the assertion above by renaming the
    // component too, which moves every import and helps nobody.
    expect(component).toContain("export function LiveTracker()");
    expect(page).toContain("LiveTracker");
  });
});
