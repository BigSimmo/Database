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
      "/differentials/presentations/acute-confusion-encephalopathy",
      ["Overview", "Comparison", "Safety", "Highest urgency", "Handoff", "Source status"],
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
    const formDecisionContext = informationPageSectionDefinitions("/forms/form-1").find(
      (section) => section.id === "decision-context",
    );
    const differentialSafety = informationPageSectionDefinitions(
      "/differentials/presentations/acute-confusion-encephalopathy",
    ).find((section) => section.id === "safety");

    expect(formDecisionContext?.fragmentId).toBe("form-decision-context");
    expect(differentialSafety?.fragmentId).toBe("differential-presentation-safety");
  });

  it("binds service section targets to IDs rendered by service-detail-page", () => {
    const servicePage = readFileSync(join(process.cwd(), "src/components/services/service-detail-page.tsx"), "utf8");
    for (const targetId of informationPageSectionDefinitions("/services/community-team").flatMap(
      (section) => section.targetIds,
    )) {
      expect(servicePage).toContain(`id="${targetId}"`);
    }
  });

  it("does not add a navigation row to a clean no-query landing page", () => {
    render(
      <PageSecondaryNavigation modeId="services" pathname="/services" hasSubmittedSearch={false} onSearch={vi.fn()} />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
  });

  it("keeps a single-destination mode on the in-flow strip after submission", () => {
    // `answer` registers one action-kind entry. Adopting the bar there would
    // delete that control rather than port it, so the strip stays.
    render(<PageSecondaryNavigation modeId="answer" pathname="/" hasSubmittedSearch onSearch={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ask" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });

  it("gives an adopted mode the shared header bar on its workflow routes", () => {
    render(
      <PageSecondaryNavigation
        modeId="specifiers"
        pathname="/specifiers/compare"
        hasSubmittedSearch={false}
        onSearch={vi.fn()}
      />,
    );
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

  it("replaces mode navigation with only the information sections present in the record", async () => {
    render(
      <div>
        <PageSecondaryNavigation
          modeId="services"
          pathname="/services/community-team"
          hasSubmittedSearch
          onSearch={vi.fn()}
        />
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
      <PageSecondaryNavigation
        modeId="prescribing"
        pathname="/medications/sertraline"
        hasSubmittedSearch
        onSearch={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.queryByTestId("secondary-navigation")).toBeNull());

    rerender(
      <PageSecondaryNavigation
        modeId="therapy-compass"
        pathname="/therapy-compass/search"
        hasSubmittedSearch={false}
        onSearch={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();

    rerender(
      <PageSecondaryNavigation
        modeId="documents"
        pathname="/documents/11111111-1111-4111-8111-111111111111"
        hasSubmittedSearch
        onSearch={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
  });
});
