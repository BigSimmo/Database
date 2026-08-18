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

  it("keeps tools in the hero from tablet up and uses the shared phone footer", () => {
    const expectedToolsShell = {
      initialMode: "tools",
      desktopSearchPlacement: "hero",
      mobileHomeComposerPlacement: "footer",
    } as const;

    expect(searchShellPropsForPathname("/tools")).toEqual(expectedToolsShell);
    expect(searchShellPropsForPathname("/tools/interaction-checker")).toEqual(expectedToolsShell);
  });

  it("maps therapy and home fallbacks", () => {
    expect(searchShellPropsForPathname("/therapy-compass/search")).toEqual({
      initialMode: "therapy-compass",
    });
    expect(searchShellPropsForPathname("/")).toEqual({ initialMode: "answer" });
  });

  it("keeps the composer on dictionary search surfaces and drops it on the governance page", () => {
    expect(searchShellPropsForPathname("/dictionary/search")).toEqual({
      initialMode: "dictionary",
      desktopSearchPlacement: "hero",
    });
    expect(searchShellPropsForPathname("/dictionary/sources")).toEqual({
      initialMode: "dictionary",
      desktopSearchPlacement: "hero",
      searchComposerVisible: false,
    });
  });

  it("assigns calculator home and results search to the shared shell", () => {
    expect(searchShellPropsForPathname("/calculators")).toEqual({
      initialMode: "calculators",
      desktopSearchPlacement: "hero",
    });
  });
});
