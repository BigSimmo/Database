import { describe, expect, it } from "vitest";

import { appModeIds, dsmSearchHref, factsheetsSearchHref, factsheetsTopicsHref, type AppModeId } from "@/lib/app-modes";
import { isInformationPage } from "@/lib/information-pages";
import {
  MODE_NAV_ADOPTED_MODES,
  activeModeSecondaryNavigationId,
  isModeSecondaryNavigationRoute,
  modeSecondaryNavigationHref,
  modeSecondaryNavigationRegistry,
  routedModeSecondaryNavigationCount,
} from "@/lib/mode-secondary-navigation";

/** Eight modes intentionally register no destinations at all — see `emptyRegistryModes`. */
const expectedLabels: Record<AppModeId, string[]> = {
  answer: [],
  documents: [],
  services: [],
  forms: [],
  favourites: [],
  differentials: ["Search", "Diagnoses", "Presentations", "Compare"],
  dsm: ["Search", "Compare"],
  specifiers: ["Search", "Build", "Compare", "Map"],
  formulation: ["Find", "Build", "Compare", "Map"],
  prescribing: [],
  tools: [],
  calculators: [],
  "therapy-compass": ["Search", "Recommend", "Compare", "Pathways", "Review"],
  factsheets: ["Search", "Topics"],
  dictionary: ["Terms", "Topics", "Compare", "Sources"],
};

const cleanLandingPath: Record<AppModeId, string> = {
  answer: "/",
  documents: "/",
  services: "/services",
  forms: "/forms",
  favourites: "/favourites",
  differentials: "/differentials",
  dsm: "/dsm",
  specifiers: "/specifiers",
  formulation: "/formulation",
  prescribing: "/medications",
  tools: "/tools",
  calculators: "/calculators",
  "therapy-compass": "/therapy-compass",
  factsheets: "/factsheets",
  dictionary: "/dictionary",
};

/**
 * The eight modes that register nothing. Each used to carry one
 * `action: "search"` entry rendering a lone <button> inside its own <nav>
 * landmark, whose only effect was focusing a composer already on screen. Every
 * one is genuinely single-surface, so the control was deleted rather than
 * ported to the shared bar.
 */
const emptyRegistryModes = [
  "answer",
  "documents",
  "services",
  "forms",
  "favourites",
  "prescribing",
  "tools",
  "calculators",
] as const satisfies readonly AppModeId[];

describe("mode secondary navigation registry", () => {
  it("covers all 15 modes with the approved destinations and no Home item", () => {
    expect(Object.keys(modeSecondaryNavigationRegistry).sort()).toEqual([...appModeIds].sort());
    expect(appModeIds).toHaveLength(15);

    for (const modeId of appModeIds) {
      const labels = modeSecondaryNavigationRegistry[modeId].map((item) => item.label);
      expect(labels).toEqual(expectedLabels[modeId]);
      expect(labels.map((label) => label.toLowerCase())).not.toContain("home");
    }
  });

  it("registers no destinations at all for the eight single-surface modes", () => {
    // Empty is a real answer, pinned rather than left incidental: a future edit
    // that re-adds a lone focus-the-composer button should have to argue with
    // this test rather than slip back in.
    for (const modeId of emptyRegistryModes) {
      expect(modeSecondaryNavigationRegistry[modeId], `${modeId} must register no destinations`).toEqual([]);
      expect(routedModeSecondaryNavigationCount(modeId)).toBe(0);
    }
  });

  it("routes DSM Search tab to the catalogue search surface", () => {
    expect(modeSecondaryNavigationRegistry.dsm[0]).toMatchObject({
      id: "search",
      label: "Search",
      href: dsmSearchHref,
    });
  });

  it("suppresses clean landing pages, and still opens the bar after a submitted search", () => {
    for (const modeId of appModeIds) {
      expect(
        isModeSecondaryNavigationRoute({ modeId, pathname: cleanLandingPath[modeId], hasSubmittedSearch: false }),
      ).toBe(false);
      expect(
        isModeSecondaryNavigationRoute({ modeId, pathname: cleanLandingPath[modeId], hasSubmittedSearch: true }),
      ).toBe(true);
    }
    // Scope note, so this stays honest for the emptied modes: the predicate
    // answers "is this a route where a bar could appear", and since the
    // single-button strips were deleted it no longer decides visibility on its
    // own. `PageSecondaryNavigation` returns null on a mode with no registered
    // destinations before it consults this at all — which is what actually
    // silences the eight above, and is asserted in
    // tests/page-secondary-navigation.dom.test.tsx.
    for (const modeId of emptyRegistryModes) {
      expect(modeSecondaryNavigationRegistry[modeId]).toEqual([]);
    }
  });

  it("recognises explicit workflow routes without treating detail routes as mode navigation", () => {
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "specifiers",
        pathname: "/specifiers/builder",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "formulation",
        pathname: "/formulation/map",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "specifiers",
        pathname: "/specifiers/search",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "specifiers",
        pathname: "/specifiers/with-anxious-distress",
        hasSubmittedSearch: false,
      }),
    ).toBe(false);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "factsheets",
        pathname: "/factsheets/topics",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "factsheets",
        pathname: "/factsheets/search",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "factsheets",
        pathname: "/factsheets/sertraline",
        hasSubmittedSearch: false,
      }),
    ).toBe(false);
  });

  it("keeps /documents/search free of a mode bar in both states", () => {
    // The dedicated `documents` clause went with its lone entry: the mode now
    // registers nothing, so an empty destination list is what silences it. The
    // unsubmitted case is still asserted because /documents/search is the
    // documents mode home, with the composer already visible — any future
    // destination there must not appear before a query is submitted.
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "documents",
        pathname: "/documents/search",
        hasSubmittedSearch: false,
      }),
    ).toBe(false);
    expect(modeSecondaryNavigationRegistry.documents).toEqual([]);
  });

  it("translates compatible workflow selection state into each destination URL", () => {
    expect(
      modeSecondaryNavigationHref({
        modeId: "specifiers",
        itemId: "search",
        href: "/specifiers/search",
        currentSearchParams: new URLSearchParams(
          "q=anxious&run=1&scope=guides&family=episode&diagnosis=depressive&category=mood&reviewed=1&specifier=with-anxious-distress",
        ),
      }),
    ).toBe(
      "/specifiers/search?q=anxious&run=1&scope=guides&family=episode&diagnosis=depressive&category=mood&reviewed=1&specifier=with-anxious-distress",
    );

    expect(
      modeSecondaryNavigationHref({
        modeId: "specifiers",
        itemId: "builder",
        href: "/specifiers/builder",
        currentSearchParams: new URLSearchParams("a=first&b=second"),
      }),
    ).toBe("/specifiers/builder?specifier=first&specifier=second");

    expect(
      modeSecondaryNavigationHref({
        modeId: "formulation",
        itemId: "compare",
        href: "/formulation/compare",
        currentSearchParams: new URLSearchParams("mechanism=threat&mechanism=avoidance"),
      }),
    ).toBe("/formulation/compare?a=threat&b=avoidance");

    expect(
      modeSecondaryNavigationHref({
        modeId: "differentials",
        itemId: "compare",
        href: "/differentials/compare",
        currentSearchParams: new URLSearchParams("q=confusion&ids=delirium%2Cdementia"),
      }),
    ).toBe("/differentials/compare?q=confusion&ids=delirium%2Cdementia");

    expect(
      modeSecondaryNavigationHref({
        modeId: "differentials",
        itemId: "presentations",
        href: "/differentials/presentations",
        currentSearchParams: new URLSearchParams("q=confusion&ids=delirium%2Cdementia"),
      }),
    ).toBe("/differentials/presentations?q=confusion&ids=delirium%2Cdementia");

    // Search restores the last query and re-opens results even when the prior
    // tab URL did not carry run=1 (e.g. Diagnoses / Presentations browse).
    expect(
      modeSecondaryNavigationHref({
        modeId: "differentials",
        itemId: "search",
        href: "/differentials?focus=1",
        currentSearchParams: new URLSearchParams("q=confusion&ids=delirium"),
      }),
    ).toBe("/differentials?focus=1&q=confusion&run=1&ids=delirium");

    // Search is the CURRENT tab on /factsheets/search, so its own link must not
    // reset what you are looking at. `run` is carried with the query because
    // dropping it flips hasSubmittedModeSearch and re-places the composer.
    expect(
      modeSecondaryNavigationHref({
        modeId: "factsheets",
        itemId: "search",
        href: factsheetsSearchHref,
        currentSearchParams: new URLSearchParams("q=sertraline&category=Medicines&run=1"),
      }),
    ).toBe("/factsheets/search?q=sertraline&category=Medicines&run=1");

    // Search still carries a category filter from the results URL even when
    // there is no query — Topics does not read that param.
    expect(
      modeSecondaryNavigationHref({
        modeId: "factsheets",
        itemId: "search",
        href: factsheetsSearchHref,
        currentSearchParams: new URLSearchParams("category=Medicines"),
      }),
    ).toBe("/factsheets/search?category=Medicines");

    // Search is the CURRENT tab on /dsm/search, so its own link must not reset
    // what you are looking at. `run` is carried with the query because dropping
    // it flips hasSubmittedModeSearch and re-places the composer.
    expect(
      modeSecondaryNavigationHref({
        modeId: "dsm",
        itemId: "search",
        href: dsmSearchHref,
        currentSearchParams: new URLSearchParams("q=depression&category=mood&run=1"),
      }),
    ).toBe("/dsm/search?q=depression&category=mood&run=1");

    // Search still carries category and support filters from the results URL
    // even when there is no query — Compare does not read those params.
    expect(
      modeSecondaryNavigationHref({
        modeId: "dsm",
        itemId: "search",
        href: dsmSearchHref,
        currentSearchParams: new URLSearchParams("category=mood&support=specifiers"),
      }),
    ).toBe("/dsm/search?category=mood&support=specifiers");

    // Search restores the last query and re-opens results even when the prior
    // tab URL did not carry run=1 (e.g. Compare with a carried query).
    expect(
      modeSecondaryNavigationHref({
        modeId: "dsm",
        itemId: "search",
        href: dsmSearchHref,
        currentSearchParams: new URLSearchParams("q=depression&ids=major-depressive-disorder"),
      }),
    ).toBe("/dsm/search?q=depression&run=1&ids=major-depressive-disorder");

    // Compare reuses URL-backed selection so ticks on search survive ModeNav
    // handoff without a second client store.
    expect(
      modeSecondaryNavigationHref({
        modeId: "dsm",
        itemId: "compare",
        href: "/dsm/compare",
        currentSearchParams: new URLSearchParams("q=depression&ids=major-depressive-disorder,bipolar"),
      }),
    ).toBe("/dsm/compare?q=depression&ids=major-depressive-disorder%2Cbipolar");

    // Topics is category browse: it reads neither param, so carrying them there
    // would only put dead query string into a URL people share.
    expect(
      modeSecondaryNavigationHref({
        modeId: "factsheets",
        itemId: "topics",
        href: factsheetsTopicsHref,
        currentSearchParams: new URLSearchParams("q=sertraline&category=Medicines&run=1"),
      }),
    ).toBe("/factsheets/topics");

    // Terms is the current tab on /dictionary/search, so its own link carries
    // the catalogue's whole state — scope, letter and facets as well as the
    // query — rather than resetting the surface the reader is already on.
    expect(
      modeSecondaryNavigationHref({
        modeId: "dictionary",
        itemId: "search",
        href: "/dictionary/search",
        currentSearchParams: new URLSearchParams("q=tardive&run=1&view=abbreviations&letter=T&kind=therapy"),
      }),
    ).toBe("/dictionary/search?q=tardive&run=1&view=abbreviations&letter=T&kind=therapy");

    expect(
      modeSecondaryNavigationHref({
        modeId: "therapy-compass",
        itemId: "compare",
        href: "/therapy-compass/compare",
        currentSearchParams: new URLSearchParams(
          "q=trauma&run=1&ids=cbt%2Cact&topic=Anxiety&density=dense&prompt=patient+name",
        ),
      }),
    ).toBe("/therapy-compass/compare?q=trauma&run=1&ids=cbt%2Cact&topic=Anxiety&density=dense");
  });

  it("adopts only modes with two or more routed destinations (explicit list, not silent derivation)", () => {
    // Membership is pinned, not just the criterion. Without this the test is
    // satisfied by any subset: drop `formulation` from the list and every
    // remaining mode still has two routed entries, while the negative check
    // below only inspects modes with fewer than two. A mode silently losing the
    // bar is the regression this list exists to make impossible.
    expect([...MODE_NAV_ADOPTED_MODES].sort()).toEqual([
      "dictionary",
      "differentials",
      "dsm",
      "factsheets",
      "formulation",
      "specifiers",
      "therapy-compass",
    ]);

    for (const modeId of MODE_NAV_ADOPTED_MODES) {
      expect(
        routedModeSecondaryNavigationCount(modeId),
        `${modeId} is adopted but has fewer than two routed entries`,
      ).toBeGreaterThanOrEqual(2);
    }

    for (const modeId of appModeIds) {
      if (routedModeSecondaryNavigationCount(modeId) < 2) {
        expect(MODE_NAV_ADOPTED_MODES).not.toContain(modeId);
      }
    }
  });

  it("does not mark Find/Search current on record routes that match no destination", () => {
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/with-anxious-distress")).toBeNull();
    expect(activeModeSecondaryNavigationId("formulation", "/formulation/avoidance")).toBeNull();
    expect(activeModeSecondaryNavigationId("dsm", "/dsm/diagnoses/major-depressive-disorder")).toBeNull();
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/builder")).toBe("builder");
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers")).toBe("search");
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/search")).toBe("search");
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/search?q=anxious&run=1")).toBe("search");

    // Factsheets records and the `/factsheets` redirect stub cannot reach
    // ModeNav today (`hasLocalInformationPageNavigation` returns null for
    // records; the home redirects). The registry fallback would mark the first
    // entry — Search — current on any unmatched path, so the mode needs its
    // own branch rather than inheriting that default.
    expect(activeModeSecondaryNavigationId("factsheets", "/factsheets/sertraline")).toBeNull();
    expect(activeModeSecondaryNavigationId("factsheets", "/factsheets")).toBeNull();
    expect(activeModeSecondaryNavigationId("factsheets", "/factsheets/topics")).toBe("topics");
    expect(activeModeSecondaryNavigationId("factsheets", "/factsheets/search")).toBe("search");
    expect(activeModeSecondaryNavigationId("therapy-compass", "/therapy-compass/search")).toBe("search");
    expect(activeModeSecondaryNavigationId("therapy-compass", "/therapy-compass/recommend")).toBe("recommend");
    expect(activeModeSecondaryNavigationId("therapy-compass", "/therapy-compass/compare")).toBe("compare");
    expect(activeModeSecondaryNavigationId("therapy-compass", "/therapy-compass/pathways")).toBe("pathways");
    expect(activeModeSecondaryNavigationId("therapy-compass", "/therapy-compass/review")).toBe("review");
    expect(activeModeSecondaryNavigationId("therapy-compass", "/therapy-compass/cbt")).toBeNull();

    // Dictionary's Search and Browse were one catalogue behind two routes and
    // are now one. `/dictionary/browse` redirects before a page renders, so no
    // destination may claim it — and Terms must not be marked current on a
    // dictionary record either.
    expect(activeModeSecondaryNavigationId("dictionary", "/dictionary/search")).toBe("search");
    expect(activeModeSecondaryNavigationId("dictionary", "/dictionary/browse")).toBeNull();
    expect(activeModeSecondaryNavigationId("dictionary", "/dictionary/auditory-hallucination")).toBeNull();
    expect(activeModeSecondaryNavigationId("dictionary", "/dictionary/topics/assessment-and-measurement")).toBe(
      "topics",
    );

    // The `registry[modeId][0]?.id` fallback is gone. A mode with no branch and
    // no entries has no current destination, rather than silently lighting its
    // first slot on every unmatched path.
    for (const modeId of emptyRegistryModes) {
      expect(activeModeSecondaryNavigationId(modeId, cleanLandingPath[modeId])).toBeNull();
    }
  });

  it("matches workflow destinations by path segment, not substring", () => {
    // A slug that happens to contain "map"/"compare"/"builder" must not claim
    // the workflow slot — `includes` would false-match these.
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/map-like-distress")).toBeNull();
    expect(activeModeSecondaryNavigationId("formulation", "/formulation/compare-threat")).toBeNull();
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/builder-notes")).toBeNull();
    expect(activeModeSecondaryNavigationId("formulation", "/formulation/map")).toBe("map");
    expect(activeModeSecondaryNavigationId("specifiers", "/specifiers/compare")).toBe("compare");
    expect(activeModeSecondaryNavigationId("differentials", "/differentials/compare")).toBe("compare");
    expect(
      activeModeSecondaryNavigationId("differentials", "/differentials/presentations/acute-confusion-encephalopathy"),
    ).toBe("presentations");
  });
});

describe("information page classification", () => {
  it.each([
    "/services/crisis-team",
    "/forms/form-1",
    "/medications/sertraline",
    "/specifiers/with-anxious-distress",
    "/formulation/avoidance",
    "/factsheets/sertraline",
    "/therapy-compass/cbt",
    "/therapy-compass/cbt/brief",
    "/therapy-compass/cbt/sheet",
    "/differentials/diagnoses/delirium",
    "/differentials/presentations/acute-confusion-encephalopathy",
    "/dsm/diagnoses/major-depressive-disorder",
    "/dsm/diagnoses/major-depressive-disorder/differentials",
    "/documents/11111111-1111-4111-8111-111111111111",
  ])("classifies %s as an information page", (pathname) => {
    expect(isInformationPage(pathname)).toBe(true);
  });

  it.each([
    "/services",
    "/forms",
    "/specifiers/builder",
    "/specifiers/search",
    "/formulation/compare",
    "/factsheets/search",
    "/factsheets/topics",
    "/therapy-compass/search",
    "/differentials/diagnoses",
    "/differentials/presentations",
    "/differentials/compare",
    "/dsm/compare",
    "/documents/search",
  ])("does not classify workflow route %s as an information page", (pathname) => {
    expect(isInformationPage(pathname)).toBe(false);
  });
});

describe("differentials mode secondary navigation active destinations", () => {
  it("marks the presentations catalogue and compare surfaces distinctly", () => {
    expect(activeModeSecondaryNavigationId("differentials", "/differentials/presentations")).toBe("presentations");
    expect(activeModeSecondaryNavigationId("differentials", "/differentials/presentations?q=confusion")).toBe(
      "presentations",
    );
    expect(
      activeModeSecondaryNavigationId("differentials", "/differentials/presentations/acute-confusion-encephalopathy"),
    ).toBe("presentations");
    expect(activeModeSecondaryNavigationId("differentials", "/differentials/compare")).toBe("compare");
    expect(activeModeSecondaryNavigationId("differentials", "/differentials/diagnoses")).toBe("diagnoses");
  });

  it("opens the mode bar on the presentations catalogue, presentation detail, and compare entry", () => {
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "differentials",
        pathname: "/differentials/presentations",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "differentials",
        pathname: "/differentials/compare",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
    expect(
      isModeSecondaryNavigationRoute({
        modeId: "differentials",
        pathname: "/differentials/presentations/acute-confusion-encephalopathy",
        hasSubmittedSearch: false,
      }),
    ).toBe(true);
  });
});
