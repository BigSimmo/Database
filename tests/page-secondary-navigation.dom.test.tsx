import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasLocalInformationPageNavigation,
  informationPageSectionDefinitions,
  PageSecondaryNavigation,
} from "@/components/page-secondary-navigation";

const navigation = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

describe("PageSecondaryNavigation", () => {
  beforeEach(() => {
    navigation.search = "";
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
  ])("recognises %s as locally controlled information navigation", (pathname) => {
    expect(hasLocalInformationPageNavigation(pathname)).toBe(true);
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

  it("does not add a navigation row to a clean no-query landing page", () => {
    render(
      <PageSecondaryNavigation modeId="services" pathname="/services" hasSubmittedSearch={false} onSearch={vi.fn()} />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
  });

  it("renders mode navigation after submission and on explicit workflow routes", () => {
    const { rerender } = render(
      <PageSecondaryNavigation modeId="answer" pathname="/" hasSubmittedSearch onSearch={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Ask" })).toHaveAttribute("aria-current", "page");

    rerender(
      <PageSecondaryNavigation
        modeId="specifiers"
        pathname="/specifiers/compare"
        hasSubmittedSearch={false}
        onSearch={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute("href", "/specifiers/builder");
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
  });
});
