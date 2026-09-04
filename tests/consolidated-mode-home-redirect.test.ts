import { describe, expect, it } from "vitest";

import { appModeHomeHref, appModeIds } from "@/lib/app-modes";
import { modeSecondaryNavigationRegistry } from "@/lib/mode-secondary-navigation";
import {
  consolidatedModeHomeModeId,
  unsubmittedModeSearchTarget,
  unsubmittedModeSearchTargetForSearchParams,
  consolidatedModeHomeModeIds,
  consolidatedModeHomeTarget,
  isConsolidatedModeHomePath,
  standaloneModeSearchPath,
  standaloneModeSubmittedSearchTarget,
  standaloneModeSubmittedSearchTargetForSearchParams,
} from "@/lib/consolidated-mode-home-redirect";

const target = (pathname: string, search = "") => consolidatedModeHomeTarget(pathname, new URLSearchParams(search));

describe("consolidated mode home redirects", () => {
  it("forwards each consolidated bare path to the shared home for its own mode", () => {
    expect(target("/dsm")).toBe("/?mode=dsm");
    expect(target("/dictionary")).toBe("/?mode=dictionary");
    expect(target("/factsheets")).toBe("/?mode=factsheets");
    expect(target("/services")).toBe("/?mode=services");
    expect(target("/forms")).toBe("/?mode=forms");
    expect(target("/calculators")).toBe("/?mode=calculators");
    expect(target("/specifiers")).toBe("/?mode=specifiers");
    expect(target("/formulation")).toBe("/?mode=formulation");
    expect(target("/differentials")).toBe("/?mode=differentials");
    expect(target("/therapy-compass")).toBe("/?mode=therapy-compass");
    expect(target("/documents")).toBe("/?mode=documents");
  });

  it("leaves every other path alone", () => {
    for (const pathname of [
      "/",
      "/favourites",
      "/tools",
      // Medication redirects too, but through its own bespoke proxy fast-path
      // (src/proxy.ts, medicationsHomeTarget()) rather than this shared map — it
      // has no `/medications/search` route for the generic ${pathname}/search
      // submitted-target logic to forward to.
      "/medications",
      "/mockups/favourites-hub",
    ]) {
      expect(target(pathname)).toBeNull();
      expect(isConsolidatedModeHomePath(pathname)).toBe(false);
    }
  });

  /*
   * Sub-routes are real surfaces, not aliases of the home. Matching them here
   * would redirect `/dsm/search` to `/?mode=dsm` and make the mode's own results
   * unreachable — the exact failure a prefix match would introduce.
   */
  it("never matches a sub-route of a consolidated namespace", () => {
    for (const pathname of [
      "/dsm/search",
      "/dsm/compare",
      "/dsm/diagnoses/major-depressive-disorder",
      "/dictionary/browse",
      "/dictionary/topics",
      "/factsheets/search",
      "/factsheets/sertraline",
      "/services/search",
      "/forms/search",
      "/calculators/search",
    ]) {
      expect(target(pathname)).toBeNull();
      expect(isConsolidatedModeHomePath(pathname)).toBe(false);
    }
  });

  /*
   * A submitted deep link goes straight to the mode's own results surface, which
   * is where the bare path rendered it before consolidation. Routing it to the
   * shared home instead was a real regression: the dashboard renders its own
   * in-place results for some modes and nothing for others, so `/forms?q=…&run=1`
   * stopped reaching FormsSearchResultsPage (caught by verify:phone-chrome).
   */
  it("forwards a submitted deep link to the mode's own results surface", () => {
    expect(target("/dsm", "q=panic+disorder&run=1")).toBe("/dsm/search?q=panic+disorder&run=1&mode=dsm");
    expect(target("/forms", "q=transport&run=1&focus=1")).toBe("/forms/search?q=transport&run=1&focus=1&mode=forms");
    expect(target("/documents", "q=lithium&run=1")).toBe("/documents/search?q=lithium&run=1&mode=documents");
    // Navigation context rides along, so a scoped or mode-qualified deep link
    // does not silently lose its filters crossing the hop.
    expect(target("/differentials", "q=acute&run=1&queryMode=compare_guidance&scope.medications=lithium")).toBe(
      "/differentials/search?q=acute&run=1&queryMode=compare_guidance&scope.medications=lithium&mode=differentials",
    );
  });

  /*
   * `query` is the legacy alias for `q` on several of these paths. Treating it as
   * "no query" here read `/services?q=%20&query=13YARN&run=1` as unsubmitted and
   * dropped an old deep link onto the home, where it found nothing.
   */
  it("counts the legacy query alias as a submitted search", () => {
    expect(target("/services", "q=%20&query=13YARN&run=1")).toBe(
      "/services/search?q=+&query=13YARN&run=1&mode=services",
    );
    expect(target("/services", "query=13YARN&run=1")).toBe("/services/search?query=13YARN&run=1&mode=services");
  });

  /*
   * Unsubmitted is the other half: a query alone is a draft, not a search, so it
   * belongs on the shared home with the composer seeded — same as before.
   */
  it("keeps an unsubmitted query on the shared home", () => {
    expect(target("/factsheets", "q=sertraline&focus=1")).toBe("/?q=sertraline&focus=1&mode=factsheets");
    // `run=1` with a blank query is not a submitted search either.
    expect(target("/dsm", "q=++&run=1")).toBe("/?q=++&run=1&mode=dsm");
  });

  it("overwrites a crafted mode parameter with the one the pathname names", () => {
    // Without this, `/dsm?mode=favourites` would bounce a visitor into an
    // unrelated mode — a redirect whose destination the query controls.
    expect(target("/dsm", "mode=favourites")).toBe("/?mode=dsm");
    expect(target("/factsheets", "mode=answer&q=x")).toBe("/?mode=factsheets&q=x");
    // Including on the submitted branch, where the destination path is the
    // mode's own namespace rather than anything the query could name.
    expect(target("/dsm", "mode=favourites&q=x&run=1")).toBe("/dsm/search?mode=dsm&q=x&run=1");
  });

  it("resolves every consolidated path to a real app mode", () => {
    for (const modeId of consolidatedModeHomeModeIds) {
      expect(appModeIds).toContain(modeId);
      expect(consolidatedModeHomeModeId(`/${modeId}`)).toBe(modeId);
    }
  });

  /*
   * The loop guard. A consolidated bare path redirects to the shared home, and the
   * shared home routes a submitted query back to the mode's own surface — so that
   * surface must never be the bare path again. `appModeHomeHref` is the only thing
   * that builds it, so asserting on its output is asserting on the real hop.
   */
  it("never routes a submitted search back at a path that redirects", () => {
    for (const modeId of consolidatedModeHomeModeIds) {
      const submitted = appModeHomeHref(modeId, { query: "clozapine", run: true });
      expect(target(new URL(submitted, "https://clinical.test").pathname)).toBeNull();
      expect(submitted.startsWith(`/${modeId}/search?`)).toBe(true);
    }
  });

  /*
   * `/calculators/search` is a browse catalogue on an empty query — the Tools
   * `/tools` analogue — so the proxy must leave it alone. Differentials still
   * has no browse view and forwards home.
   */
  it("leaves an unsubmitted calculators search on the catalogue", () => {
    const search = (pathname: string, query = "") => unsubmittedModeSearchTarget(pathname, new URLSearchParams(query));

    expect(search("/calculators/search")).toBeNull();
    expect(search("/calculators/search", "q=+++")).toBeNull();
    expect(search("/calculators/search", "q=%20&run=1&focus=1")).toBeNull();
  });

  /*
   * Differentials search has no browse view: empty visits forward home.
   * Formulation and specifiers keep their empty `/search` as the catalogue
   * (`tests/ui-phone-scroll-routes.spec.ts` pins formulation). Factsheets,
   * Dictionary and Therapy stay off this map because mode nav links them with
   * no query. Calculators now browses in place on an empty query.
   */
  it("forwards empty differentials search to the shared home", () => {
    const search = (pathname: string, query = "") => unsubmittedModeSearchTarget(pathname, new URLSearchParams(query));

    expect(search("/differentials/search")).toBe("/?mode=differentials");
    expect(search("/differentials/search", "q=")).toBe("/?mode=differentials");
    expect(search("/differentials/search", "q=%20")).toBe("/?mode=differentials");
    expect(search("/differentials/search", "run=1")).toBe("/?mode=differentials");
    expect(search("/differentials/search", "q=%20&run=1")).toBe("/?mode=differentials");
  });

  /*
   * The proxy and the page-level backstop must agree. Hardcoding `/?mode=<id>`
   * on the page dropped `focus`, `queryMode` and scope filters that the proxy
   * keeps. The page helper therefore has to go through this same builder.
   */
  it("strips only q, query and run from an unsubmitted search, keeping navigation context", () => {
    const search = (pathname: string, query = "") => unsubmittedModeSearchTarget(pathname, new URLSearchParams(query));

    expect(search("/differentials/search", "run=1&focus=1&queryMode=compare_guidance")).toBe(
      "/?focus=1&queryMode=compare_guidance&mode=differentials",
    );
    expect(
      unsubmittedModeSearchTargetForSearchParams("/differentials/search", {
        run: "1",
        focus: "1",
        queryMode: "compare_guidance",
      }),
    ).toBe("/?focus=1&queryMode=compare_guidance&mode=differentials");
  });

  it("leaves query-free browse surfaces alone", () => {
    const search = (pathname: string, query = "") => unsubmittedModeSearchTarget(pathname, new URLSearchParams(query));

    for (const pathname of [
      "/calculators/search",
      "/formulation/search",
      "/specifiers/search",
      "/factsheets/search",
      "/dictionary/search",
      "/therapy-compass/search",
    ]) {
      expect(search(pathname)).toBeNull();
    }
    // A submitted search is never redirected, and `query` counts as submitted so a
    // legacy deep link reaches the route's own canonicalisation instead of bouncing.
    expect(search("/differentials/search", "q=pain&run=1")).toBeNull();
    expect(search("/calculators/search", "query=PHQ-9")).toBeNull();
  });

  /*
   * Every mode nav destination must survive the proxy. A future addition to the
   * no-browse-view set that collides with a linked tab would strand that tab on
   * the shared home; this walks the real registry rather than a copy of it.
   */
  it("never redirects a route the mode nav links to without a query", () => {
    for (const entries of Object.values(modeSecondaryNavigationRegistry)) {
      for (const entry of entries) {
        if (!("href" in entry) || !entry.href || entry.href.includes("?")) continue;
        expect(unsubmittedModeSearchTarget(entry.href, new URLSearchParams()), entry.href).toBeNull();
      }
    }
  });
});

/*
 * `/sources` is the mirror image of a consolidated home: its bare path renders a
 * real home, so only a *submitted* link forwards — to the catalogue that used to
 * live at the bare path. An unsubmitted request must fall through and render the
 * home, and the href builder and the redirect must agree on the destination.
 */
describe("standalone mode homes with a separate results route", () => {
  const submitted = (pathname: string, search = "") =>
    standaloneModeSubmittedSearchTarget(pathname, new URLSearchParams(search));

  it("forwards a submitted Sources link to the catalogue, preserving the query string", () => {
    expect(submitted("/sources", "q=RANZCP&run=1")).toBe("/sources/search?q=RANZCP&run=1");
    expect(submitted("/sources", "q=RANZCP&run=1&focus=1&band=A")).toBe(
      "/sources/search?q=RANZCP&run=1&focus=1&band=A",
    );
    // The legacy `query` alias counts as submitted, exactly as it does for the
    // consolidated paths, so an old deep link is not silently stripped.
    expect(submitted("/sources", "query=RANZCP&run=1")).toBe("/sources/search?query=RANZCP&run=1");
  });

  it("leaves an unsubmitted visit on the home so the home can render", () => {
    expect(submitted("/sources")).toBeNull();
    expect(submitted("/sources", "focus=1")).toBeNull();
    // A query with no `run=1` is a draft, not a submission.
    expect(submitted("/sources", "q=RANZCP")).toBeNull();
    // An empty query with `run=1` has nothing to search for.
    expect(submitted("/sources", "q=%20&run=1")).toBeNull();
  });

  // A filter chip has no "draft" state the way a typed query does — a link
  // carrying one is a complete, shareable catalogue selection on its own, so it
  // forwards without needing `run=1`.
  it("forwards a filter-only deep link even without run=1", () => {
    expect(submitted("/sources", "topic=governance")).toBe("/sources/search?topic=governance");
    expect(submitted("/sources", "usedBy=dictionary")).toBe("/sources/search?usedBy=dictionary");
    expect(submitted("/sources", "band=A&jurisdiction=AU")).toBe("/sources/search?band=A&jurisdiction=AU");
    // A filter alongside a draft (unsubmitted) query still forwards; the filter
    // is the reason, not the query.
    expect(submitted("/sources", "q=RANZCP&topic=governance")).toBe("/sources/search?q=RANZCP&topic=governance");
  });

  it("never matches a sub-route, another mode home, or a mode without a separate results route", () => {
    for (const pathname of [
      "/sources/search",
      "/sources/topics",
      "/sources/method",
      "/sources/src_example",
      "/medications",
      "/favourites",
      "/tools",
      "/documents",
      "/",
    ]) {
      expect(submitted(pathname, "q=RANZCP&run=1"), pathname).toBeNull();
    }
    expect(standaloneModeSearchPath("prescribing")).toBeNull();
    expect(standaloneModeSearchPath("tools")).toBeNull();
  });

  it("resolves the same destination the href builder uses", () => {
    expect(standaloneModeSearchPath("sources")).toBe("/sources/search");
    expect(appModeHomeHref("sources", { query: "RANZCP", run: true })).toBe("/sources/search?q=RANZCP&run=1");
    // Unsubmitted stays on the home rather than deep-linking the catalogue.
    expect(appModeHomeHref("sources")).toBe("/sources");
  });

  it("reads a page's own searchParams the same way the proxy reads the URL", () => {
    expect(standaloneModeSubmittedSearchTargetForSearchParams("/sources", { q: "RANZCP", run: "1" })).toBe(
      "/sources/search?q=RANZCP&run=1",
    );
    expect(standaloneModeSubmittedSearchTargetForSearchParams("/sources", {})).toBeNull();
  });
});
