import { describe, expect, it } from "vitest";

import { appModeHomeHref, appModeIds } from "@/lib/app-modes";
import {
  consolidatedModeHomeModeId,
  consolidatedModeHomeModeIds,
  consolidatedModeHomeTarget,
  isConsolidatedModeHomePath,
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
    for (const pathname of ["/", "/favourites", "/tools", "/medications", "/mockups/dsm-home-detailed"]) {
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
      "/therapy-compass/search",
    ]) {
      expect(target(pathname)).toBeNull();
      expect(isConsolidatedModeHomePath(pathname)).toBe(false);
    }
  });

  /*
   * A submitted deep link must survive the hop. `/dsm?q=…&run=1` carries its query
   * to `/?mode=dsm&q=…&run=1`, which the shared home resolves onward to `/dsm/search`.
   * The onward hop targets the search surface, not the bare path, so this cannot loop.
   */
  it("carries the incoming query across so submitted deep links still resolve", () => {
    expect(target("/dsm", "q=panic+disorder&run=1")).toBe("/?q=panic+disorder&run=1&mode=dsm");
    expect(target("/factsheets", "q=sertraline&focus=1")).toBe("/?q=sertraline&focus=1&mode=factsheets");
  });

  it("overwrites a crafted mode parameter with the one the pathname names", () => {
    // Without this, `/dsm?mode=favourites` would bounce a visitor into an
    // unrelated mode — a redirect whose destination the query controls.
    expect(target("/dsm", "mode=favourites")).toBe("/?mode=dsm");
    expect(target("/factsheets", "mode=answer&q=x")).toBe("/?mode=factsheets&q=x");
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
});
