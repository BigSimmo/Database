import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ServiceDetailPage } from "@/components/services/service-detail-page";
import type { ServiceRecord } from "@/lib/service-ranker";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  // InPageNavHeader derives its sheet state from the pathname; without this the
  // mock throws before the page renders.
  usePathname: () => "/services/test-service",
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

describe("ServiceDetailPage content cleanup", () => {
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
