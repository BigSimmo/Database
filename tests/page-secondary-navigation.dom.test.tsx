import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

type MockLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

vi.mock("next/link", async () => {
  const { forwardRef } = await import("react");
  const MockLink = forwardRef<HTMLAnchorElement, MockLinkProps>(({ children, href, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = "MockNextLink";
  return { __esModule: true, default: MockLink };
});

import { FormulationSubnav } from "@/components/formulation/formulation-ui";
import {
  hasLocalInformationPageNavigation,
  informationPageSectionDefinitions,
  PageSecondaryNavigation,
} from "@/components/page-secondary-navigation";
import { SpecifierSubnav } from "@/components/specifiers/specifier-ui";

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
      [
        "Overview",
        "Decision context",
        "Priority facts",
        "Legal boundary",
        "Form information",
        "Source / verification",
      ],
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

  it("does not add a navigation row to a clean one-destination landing page", () => {
    render(
      <PageSecondaryNavigation modeId="services" pathname="/services" hasSubmittedSearch={false} onSearch={vi.fn()} />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });

  it.each([
    ["answer", "/"],
    ["documents", "/documents/search"],
    ["services", "/services"],
    ["forms", "/forms"],
    ["favourites", "/favourites"],
    ["prescribing", "/medications"],
    ["tools", "/tools"],
    ["factsheets", "/factsheets/search"],
  ] as const)("keeps the one-destination %s mode free of a redundant menu", (modeId, pathname) => {
    render(<PageSecondaryNavigation modeId={modeId} pathname={pathname} hasSubmittedSearch onSearch={vi.fn()} />);

    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });

  it.each([
    ["differentials", "/differentials", "Differentials pages", "Search", "/differentials?focus=1"],
    [
      "differentials",
      "/differentials/diagnoses",
      "Differentials pages",
      "Diagnoses",
      "/differentials/diagnoses",
    ],
    ["dsm", "/dsm", "DSM-5 Diagnosis pages", "Search", "/dsm?focus=1"],
    ["dsm", "/dsm/compare", "DSM-5 Diagnosis pages", "Compare", "/dsm/compare"],
  ] as const)(
    "renders the %s workflow as the shared header-integrated mode nav",
    (modeId, pathname, ariaLabel, activeLabel, activeHref) => {
      render(
        <PageSecondaryNavigation
          modeId={modeId}
          pathname={pathname}
          hasSubmittedSearch={false}
          onSearch={vi.fn()}
        />,
      );

      expect(screen.getByRole("navigation", { name: ariaLabel })).toHaveAttribute("data-testid", "mode-nav");
      expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("href", activeHref);
      expect(screen.queryByTestId("secondary-navigation")).toBeNull();
    },
  );

  it.each([
    ["specifiers", "Build", "/specifiers/builder"],
    ["formulation", "Map", "/formulation/map"],
  ] as const)("renders the real %s workflow owner through ModeNav", (modeId, activeLabel, activeHref) => {
    render(modeId === "specifiers" ? <SpecifierSubnav active="builder" /> : <FormulationSubnav active="map" />);

    expect(screen.getByTestId("mode-nav")).toHaveAttribute(
      "aria-label",
      modeId === "specifiers" ? "Specifiers pages" : "Formulation pages",
    );
    expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("href", activeHref);
    expect(screen.queryByRole("navigation", { name: /tools/i })).toBeNull();
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
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
    expect(screen.queryByTestId("mode-nav")).toBeNull();
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
    expect(screen.queryByTestId("mode-nav")).toBeNull();

    rerender(
      <PageSecondaryNavigation
        modeId="therapy-compass"
        pathname="/therapy-compass/search"
        hasSubmittedSearch={false}
        onSearch={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
    expect(screen.queryByTestId("mode-nav")).toBeNull();

    rerender(
      <PageSecondaryNavigation
        modeId="documents"
        pathname="/documents/11111111-1111-4111-8111-111111111111"
        hasSubmittedSearch
        onSearch={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("secondary-navigation")).toBeNull();
    expect(screen.queryByTestId("mode-nav")).toBeNull();
  });
});
