import { describe, expect, it } from "vitest";

import { appModeIds } from "@/lib/app-modes";
import {
  consolidatedModeHomeModeId,
  consolidatedModeHomeTarget,
  isConsolidatedModeHomePath,
} from "@/lib/consolidated-mode-home-redirect";

const target = (pathname: string, search = "") => consolidatedModeHomeTarget(pathname, new URLSearchParams(search));

describe("consolidated mode home redirects", () => {
  it("forwards each consolidated bare path to the shared home for its own mode", () => {
    expect(target("/dsm")).toBe("/?mode=dsm");
    expect(target("/dictionary")).toBe("/?mode=dictionary");
    expect(target("/factsheets")).toBe("/?mode=factsheets");
  });

  it("leaves every other path alone", () => {
    for (const pathname of ["/", "/services", "/tools", "/documents", "/mockups/dsm-home-detailed"]) {
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
    for (const pathname of ["/dsm", "/dictionary", "/factsheets"]) {
      const modeId = consolidatedModeHomeModeId(pathname);
      expect(modeId).not.toBeNull();
      expect(appModeIds).toContain(modeId);
    }
  });
});
