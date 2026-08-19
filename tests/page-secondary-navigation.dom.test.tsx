import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `ModeNav` reads the path only as a fallback for a missing `activeId`, which
// neither consumer relies on — but it still calls the hook, so an adopted mode
// needs a router here.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { hasLocalInformationPageNavigation, PageSecondaryNavigation } from "@/components/page-secondary-navigation";

describe("PageSecondaryNavigation", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
      () => [{ width: 100, height: 40 }] as unknown as DOMRectList,
    );
  });

  it.each([
    "/medications/sertraline",
    "/differentials/diagnoses/delirium",
    "/differentials/presentations/acute-confusion-encephalopathy",
    "/factsheets/sertraline",
    "/therapy-compass/cbt",
    "/documents/11111111-1111-4111-8111-111111111111",
    // The six routes converted onto `InPageNavHeader`. They used to reach the
    // shell's "On this page" rail instead; now they own their navigation like
    // every other information page, which is what collapsed this predicate to
    // `isInformationPage`.
    "/services/community-team",
    "/forms/form-1",
    "/specifiers/with-anxious-distress",
    "/formulation/avoidance",
    "/dsm/diagnoses/major-depressive-disorder",
    "/dsm/diagnoses/major-depressive-disorder/differentials",
  ])("recognises %s as locally controlled information navigation", (pathname) => {
    expect(hasLocalInformationPageNavigation(pathname)).toBe(true);
  });

  it.each([
    // Search and tool surfaces are mode routes, not records: they keep the mode
    // bar, so the predicate must not swallow them along with their siblings.
    "/documents/search",
    "/services",
    "/specifiers/compare",
    "/specifiers/builder",
    "/formulation/map",
    "/dsm/search",
    "/dsm/compare",
    "/factsheets/search",
  ])("does not treat %s as locally owned information navigation", (pathname) => {
    expect(hasLocalInformationPageNavigation(pathname)).toBe(false);
  });

  it("draws no shell navigation on a route that owns an InPageNavHeader", async () => {
    // The header these routes mount is page-owned and portals into the phone
    // collapse slot; a shell bar as well would be the second one.
    render(
      <div>
        <PageSecondaryNavigation
          modeId="specifiers"
          pathname="/specifiers/with-anxious-distress"
          hasSubmittedSearch={false}
        />
        <section id="specifier-overview" />
        <section id="specifier-fit" />
      </div>,
    );

    await waitFor(() => expect(screen.queryByTestId("secondary-navigation")).toBeNull());
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });

  it("does not add a navigation row to a clean no-query landing page", () => {
    render(<PageSecondaryNavigation modeId="services" pathname="/services" hasSubmittedSearch={false} />);
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
  });

  it("renders nothing for a mode that registers no destinations", () => {
    // `answer` used to register one action-kind entry, rendering a lone
    // <button name="Ask"> with aria-current="page" inside its own <nav>
    // landmark. Its only effect was focusing the composer already visible on
    // the same screen, so it was deleted rather than ported to the header bar —
    // there was no second destination to port it to. Neither surface may appear
    // now, and hasSubmittedSearch must not resurrect one.
    render(<PageSecondaryNavigation modeId="answer" pathname="/" hasSubmittedSearch />);
    expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });

  it("gives an adopted mode the shared header bar on its workflow routes", () => {
    render(<PageSecondaryNavigation modeId="specifiers" pathname="/specifiers/compare" hasSubmittedSearch={false} />);
    const bar = screen.getByTestId("mode-nav");
    expect(bar).toHaveAttribute("aria-label", "Specifiers pages");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute("href", "/specifiers/builder");
    // Registry order is load-bearing: only the first two slots survive the
    // narrowest band, so Find and Build must be the ones that stay.
    expect([...bar.querySelectorAll("li a")].map((link) => link.textContent)).toEqual([
      "Find",
      "Build",
      "Compare",
      "Map",
    ]);
  });

  it("leaves presentation comparison navigation to the resolved page workflow", () => {
    render(
      <PageSecondaryNavigation
        modeId="differentials"
        pathname="/differentials/presentations/acute-confusion-encephalopathy"
        hasSubmittedSearch={false}
      />,
    );

    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });

  it("gives factsheets both destinations and keeps the current tab's filter state", () => {
    render(
      <PageSecondaryNavigation
        modeId="factsheets"
        pathname="/factsheets/search"
        hasSubmittedSearch={false}
        searchParamString="q=sertraline&category=Medicines&run=1"
      />,
    );
    const bar = screen.getByTestId("mode-nav");
    expect(bar).toHaveAttribute("aria-label", "Factsheets pages");
    expect([...bar.querySelectorAll("li a")].map((link) => link.textContent)).toEqual(["Topics", "Search"]);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
    // Search is the tab you are already on. Its own link must not reset the
    // category filter you are reading, nor drop `run` — that flips
    // hasSubmittedModeSearch and re-places the composer for a no-op click.
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/factsheets/search?q=sertraline&category=Medicines&run=1",
    );
    // Topics is the mode home — the shared lightweight one since `/factsheets`
    // became a redirect. It reads neither param, and carries no focus=1 either:
    // autofocusing the composer there would open the phone keyboard unbidden.
    expect(screen.getByRole("link", { name: "Topics" })).toHaveAttribute("href", "/?mode=factsheets");
  });

  it("keeps the newly adopted factsheets bar off its record routes", () => {
    // Until adoption, `/factsheets/<slug>` was bar-free incidentally: the mode
    // had one destination and ModeNav renders nothing below two. That
    // protection expired the moment factsheets got a second one. What keeps the
    // record route clear now is only the hasLocalInformationPageNavigation
    // early return, so pin it at render rather than trusting the count.
    expect(hasLocalInformationPageNavigation("/factsheets/sertraline")).toBe(true);
    render(<PageSecondaryNavigation modeId="factsheets" pathname="/factsheets/sertraline" hasSubmittedSearch />);
    expect(screen.queryByTestId("mode-nav")).toBeNull();
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
  });

  it("leaves information navigation local and renders Therapy workflow navigation from the shared registry", async () => {
    const { rerender } = render(
      <PageSecondaryNavigation modeId="prescribing" pathname="/medications/sertraline" hasSubmittedSearch />,
    );
    await waitFor(() => expect(screen.queryByTestId("secondary-navigation")).toBeNull());

    rerender(
      <PageSecondaryNavigation
        modeId="therapy-compass"
        pathname="/therapy-compass/search"
        hasSubmittedSearch={false}
      />,
    );
    expect(screen.getByTestId("mode-nav")).toBeVisible();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/therapy-compass/search");
    expect(screen.getByRole("link", { name: "Recommend" })).toHaveAttribute("href", "/therapy-compass/recommend");
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/therapy-compass/compare");
    expect(screen.getByRole("link", { name: "Pathways" })).toHaveAttribute("href", "/therapy-compass/pathways");

    rerender(
      <PageSecondaryNavigation
        modeId="documents"
        pathname="/documents/11111111-1111-4111-8111-111111111111"
        hasSubmittedSearch
      />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
  });
});
