import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ServiceDetailPage } from "@/components/services/service-detail-page";
import { buildServiceSectionIndex } from "@/components/services/service-section-index";
import type { ServiceRecord } from "@/lib/service-ranker";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
    isAuthenticated: true,
  }),
}));

function baseService(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    slug: "test-service",
    title: "Test Service",
    subtitle: "Short clinical fit",
    statusChips: [{ label: "High confidence", tone: "success" }],
    primaryContact: { label: "Phone", value: "13 92 76", kind: "phone" },
    contacts: [{ label: "Phone", value: "13 92 76", kind: "phone" }],
    route: "Self phone referral",
    eligibility: "Eligible callers",
    cost: "Free",
    referral: "Self phone referral",
    summaryCards: [
      { id: "route", label: "Route", title: "Self phone referral" },
      { id: "best-use", label: "Best use", title: "Crisis support" },
      { id: "eligibility", label: "Eligibility", title: "Eligible callers" },
      { id: "cost", label: "Cost", title: "Free" },
    ],
    referralInfo: [
      { label: "Primary route", value: "Self phone referral" },
      { label: "Phone", value: "13 92 76" },
    ],
    bestUse: "Crisis support",
    criteria: [{ label: "Eligible callers", tone: "meet" }],
    verification: { locallyVerified: false, confidence: "High", notes: ["Verify locally before use"] },
    tags: ["crisis"],
    catchments: ["Statewide"],
    catalogueLabel: "Catalogue service",
    navigatorQuery: "Test Service",
    source: { label: "Catalogue", status: "Source checked" },
    ...overrides,
  };
}

describe("buildServiceSectionIndex", () => {
  it("always includes overview and verification, and omits empty optional sections", () => {
    expect(
      buildServiceSectionIndex({
        showQuickFacts: false,
        showReferralSection: false,
        showCriteriaSection: false,
      }).map((section) => section.id),
    ).toEqual(["service-overview", "service-verification"]);

    expect(
      buildServiceSectionIndex({
        showQuickFacts: true,
        showReferralSection: true,
        showCriteriaSection: true,
      }).map((section) => section.id),
    ).toEqual([
      "service-overview",
      "service-quick-facts",
      "service-referral",
      "service-criteria",
      "service-verification",
    ]);
  });
});

describe("ServiceDetailPage content cleanup", () => {
  it("mounts InPageNavHeader without breadcrumbs and keeps Save/Close in the actions sheet", async () => {
    const user = userEvent.setup();
    render(<ServiceDetailPage service={baseService()} />);

    expect(screen.getByTestId("service-detail-header")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to services" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Test Service" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save service" })).not.toBeInTheDocument();

    await user.click(screen.getByTestId("service-actions-trigger"));
    expect(screen.getByRole("button", { name: "Save service" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close service" })).toBeInTheDocument();
  });

  it("hides quick facts, referral, criteria, and tags when those sections have no content", () => {
    render(
      <ServiceDetailPage
        service={baseService({
          subtitle: undefined,
          route: undefined,
          eligibility: undefined,
          cost: undefined,
          referral: undefined,
          bestUse: undefined,
          summaryCards: [],
          referralInfo: [],
          criteria: [],
          tags: [],
          catchments: [],
        })}
      />,
    );

    expect(screen.queryByLabelText("Service quick facts")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Referral information" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Referral criteria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tags & catchments" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verification" })).toBeInTheDocument();
    expect(screen.getByTestId("service-section-trigger")).toHaveTextContent("Overview");
    expect(screen.getByTestId("service-section-trigger")).not.toHaveTextContent("Quick facts");
    expect(screen.getByTestId("service-section-trigger")).not.toHaveTextContent("Referral");
  });

  it("shows a short website host instead of a raw multi-line URL", () => {
    const longUrl =
      "https://www.mhc.wa.gov.au/getting-help/other-support-services/community-support-and-treatment-services/community-alcohol-and-drug-services";
    render(
      <ServiceDetailPage
        service={baseService({
          primaryContact: { label: "Website", value: longUrl, detail: "Public source URL", kind: "web" },
          contacts: [{ label: "Website", value: longUrl, detail: "Public source URL", kind: "web" }],
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "mhc.wa.gov.au" })).toBeInTheDocument();
    expect(screen.queryByText(longUrl)).not.toBeInTheDocument();
  });

  it("compacts pipe-joined fallback summary and referral text for display", () => {
    render(
      <ServiceDetailPage
        service={baseService({
          summaryCards: undefined,
          referralInfo: undefined,
          route: "Self-referral accepted | Self-referral accepted by phone",
          eligibility: "Age 12+ | Age 12+ and families/carers",
          cost: "Free/confidential | Free | Free public AOD service",
          referral: "Self-referral accepted | Self-referral accepted by phone",
          bestUse: "Core counselling | Front door for counselling",
          subtitle: "Core counselling | Front door for counselling",
        })}
      />,
    );

    expect(screen.getByLabelText("Service quick facts")).toBeInTheDocument();
    expect(screen.queryByText(/\|/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Self-referral accepted by phone").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free/confidential").length).toBeGreaterThan(0);
  });
});
