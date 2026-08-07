import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `ModeNav` reads the path only as a fallback for a missing `activeId`, which
// neither consumer relies on — but it still calls the hook, so an adopted mode
// needs a router here.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import {
  hasLocalInformationPageNavigation,
  informationPageSectionDefinitions,
  PageSecondaryNavigation,
} from "@/components/page-secondary-navigation";

describe("PageSecondaryNavigation", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
      () => [{ width: 100, height: 40 }] as unknown as DOMRectList,
    );
  });

  it.each([
    ["/services/community-team", ["Overview", "Quick facts", "Referral", "Criteria", "Verification"]],
    [
      "/forms/form-1",
      ["Overview", "Decision context", "Priority facts", "Legal boundary", "Form information", "Source / verification"],
    ],
    ["/specifiers/with-anxious-distress", ["Overview", "Fit & exclusions", "Wording / coding", "Evidence / source"]],
    [
      "/formulation/avoidance",
      ["Overview", "What matters now", "Fit", "5 Ps", "Treatment leverage", "Evidence / source"],
    ],
    [
      "/dsm/diagnoses/major-depressive-disorder",
      ["Criteria", "Key features", "Specifiers", "Documentation", "Record summary"],
    ],
    [
      "/dsm/diagnoses/major-depressive-disorder/differentials",
      ["Overview", "Filters", "Considerations", "Clarify / review"],
    ],
    ["/documents/11111111-1111-4111-8111-111111111111", ["PDF", "Evidence", "Text", "Summary", "Images"]],
  ] as const)("defines the approved section set for %s", (pathname, labels) => {
    expect(informationPageSectionDefinitions(pathname).map((section) => section.label)).toEqual(labels);
  });

  it.each([
    "/medications/sertraline",
    "/differentials/diagnoses/delirium",
    "/factsheets/sertraline",
    "/therapy-compass/cbt",
    "/documents/11111111-1111-4111-8111-111111111111",
  ])("recognises %s as locally controlled information navigation", (pathname) => {
    expect(hasLocalInformationPageNavigation(pathname)).toBe(true);
  });

  it("does not treat /documents/search as locally owned document-viewer navigation", () => {
    expect(hasLocalInformationPageNavigation("/documents/search")).toBe(false);
  });

  it("uses stable semantic fragments for breakpoint-specific section targets", () => {
    // A fragmentId is the stable href when a section's target differs across
    // breakpoints; SecondaryNavigation still scrolls via the targetId, so the
    // fragment never needs to exist as an element.
    const formDecisionContext = informationPageSectionDefinitions("/forms/form-1").find(
      (section) => section.id === "decision-context",
    );
    const formSourceVerification = informationPageSectionDefinitions("/forms/form-1").find(
      (section) => section.id === "verification",
    );

    expect(formDecisionContext?.fragmentId).toBe("form-decision-context");
    expect(formSourceVerification?.fragmentId).toBe("form-source-verification");
  });

  it("claims no section set for the differentials presentation workflow", () => {
    // It declared six sections whose targetIds no component rendered, so
    // AvailableInformationPageNavigation filtered them all out and returned
    // null — the route claimed and nothing drawn (/issues #256). The set is
    // deleted rather than wired: the page owns navigation at every width
    // already (MobileTabs below xl, the "Differential review sidebar" aside at
    // xl showing every panel at once), and three of the six declared a -mobile
    // variant that no render could ever satisfy.
    expect(informationPageSectionDefinitions("/differentials/presentations/acute-confusion-encephalopathy")).toEqual(
      [],
    );
    expect(hasLocalInformationPageNavigation("/differentials/presentations/acute-confusion-encephalopathy")).toBe(true);
  });

  it("binds service section targets to IDs rendered by service-detail-page", () => {
    const servicePage = readFileSync(join(process.cwd(), "src/components/services/service-detail-page.tsx"), "utf8");
    for (const targetId of informationPageSectionDefinitions("/services/community-team").flatMap(
      (section) => section.targetIds,
    )) {
      expect(servicePage).toContain(`id="${targetId}"`);
    }
  });

  it("binds form section targets to IDs rendered by form-detail-page", () => {
    // The gap /issues #256 was about: this page declared six sections and
    // rendered zero `id=` attributes, so its nav filtered to nothing and drew
    // nothing at all. Every literal below is at a call site in this file, so a
    // vacuous pass is not possible — a target moved behind a variable would
    // fail here and needs a rendered-DOM assertion instead.
    const formPage = readFileSync(join(process.cwd(), "src/components/forms/form-detail-page.tsx"), "utf8");
    for (const targetId of informationPageSectionDefinitions("/forms/form-1").flatMap((section) => section.targetIds)) {
      expect(formPage).toContain(`id="${targetId}"`);
    }
  });

  it("binds specifier section targets to IDs rendered by specifier record pages", () => {
    const recordPage = readFileSync(join(process.cwd(), "src/components/specifiers/specifier-record-page.tsx"), "utf8");
    const referencePage = readFileSync(
      join(process.cwd(), "src/components/specifiers/specifier-reference-page.tsx"),
      "utf8",
    );
    for (const targetId of informationPageSectionDefinitions("/specifiers/with-anxious-distress").flatMap(
      (section) => section.targetIds,
    )) {
      // Fit is enrichment-gated on the catalogue reference page; the curated
      // record page must always expose every declared target.
      expect(recordPage).toContain(`id="${targetId}"`);
      if (targetId !== "specifier-fit") {
        expect(referencePage).toContain(`id="${targetId}"`);
      }
    }
    expect(referencePage).toContain('id="specifier-fit"');
  });

  it("binds formulation section targets to IDs rendered by formulation-mechanism-page", () => {
    const mechanismPage = readFileSync(
      join(process.cwd(), "src/components/formulation/formulation-mechanism-page.tsx"),
      "utf8",
    );
    for (const targetId of informationPageSectionDefinitions("/formulation/avoidance").flatMap(
      (section) => section.targetIds,
    )) {
      expect(mechanismPage).toContain(`id="${targetId}"`);
    }
  });

  it("renders On this page for a specifier record when its section targets are present", async () => {
    render(
      <div>
        <PageSecondaryNavigation
          modeId="specifiers"
          pathname="/specifiers/with-anxious-distress"
          hasSubmittedSearch={false}
        />
        <section id="specifier-overview" />
        <section id="specifier-fit" />
        <section id="specifier-wording" />
        <aside id="specifier-evidence" />
      </div>,
    );

    const onThisPage = await screen.findByRole("navigation", { name: "On this page" });
    expect(onThisPage).toBeVisible();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "#specifier-overview");
    expect(screen.getByRole("link", { name: "Fit & exclusions" })).toHaveAttribute("href", "#specifier-fit");
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

  it("still gives an empty-registry mode its On this page nav", async () => {
    // Branch order guard. `forms` registers no destinations but its route still
    // claims a section set, and the informationDefinitions branch sits above
    // the mode branch precisely so that survives. Hoisting the empty-registry
    // return up with the therapy/locally-owned early returns would silently
    // strip navigation from every /services/*, /forms/*, /medications/* and
    // /documents/<id> record.
    //
    // The anchors are planted here rather than taken from the real page on
    // purpose: this asserts branch ORDER only. That form-detail-page.tsx now
    // renders these ids for real is the separate binding guard above — jsdom
    // applies no Tailwind, so `lg:hidden` produces no `display:none` here and
    // this could not tell a -mobile target from its -desktop twin anyway.
    render(
      <div>
        <PageSecondaryNavigation modeId="forms" pathname="/forms/form-1" hasSubmittedSearch />
        <section id="form-overview" />
        <section id="form-priority-facts" />
        <section id="form-legal-boundary" />
      </div>,
    );
    expect(await screen.findByRole("navigation", { name: "On this page" })).toBeVisible();
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
    // Topics is the browse home: it reads neither param, and carries no
    // focus=1 either — autofocusing the composer there would open the phone
    // keyboard over the topics the user just asked to browse.
    expect(screen.getByRole("link", { name: "Topics" })).toHaveAttribute("href", "/factsheets");
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

  it("replaces mode navigation with only the information sections present in the record", async () => {
    render(
      <div>
        <PageSecondaryNavigation modeId="services" pathname="/services/community-team" hasSubmittedSearch />
        <section id="service-overview" />
        <section id="service-criteria" />
      </div>,
    );

    const onThisPage = await screen.findByRole("navigation", { name: "On this page" });
    expect(onThisPage).toBeVisible();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "#service-overview");
    expect(screen.getByRole("link", { name: "Criteria" })).toHaveAttribute("href", "#service-criteria");
    expect(screen.queryByRole("link", { name: "Quick facts" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("leaves locally controlled information and Therapy workflow navigation to their page owners", async () => {
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
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();

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
