import { describe, expect, it } from "vitest";

import { searchShellPropsForPathname } from "@/lib/search-shell-props";

describe("searchShellPropsForPathname", () => {
  it("keeps documents composer visible only on the search route", () => {
    expect(searchShellPropsForPathname("/documents/search")).toMatchObject({
      initialMode: "documents",
      searchComposerVisible: true,
      mobileChromeVisible: true,
    });
    expect(searchShellPropsForPathname("/documents/source")).toMatchObject({
      initialMode: "documents",
      searchComposerVisible: false,
      mobileChromeVisible: false,
    });
  });

  it("scopes favourites and forms mode menus", () => {
    expect(searchShellPropsForPathname("/favourites")).toMatchObject({
      initialMode: "favourites",
      availableModeIds: ["favourites"],
      desktopSearchPlacement: "hero",
    });
    expect(searchShellPropsForPathname("/forms")).toMatchObject({
      initialMode: "forms",
      availableModeIds: ["forms"],
    });
  });

  it("maps therapy and home fallbacks", () => {
    expect(searchShellPropsForPathname("/therapy-compass/search")).toEqual({
      initialMode: "therapy-compass",
    });
    expect(searchShellPropsForPathname("/")).toEqual({ initialMode: "answer" });
  });
});
