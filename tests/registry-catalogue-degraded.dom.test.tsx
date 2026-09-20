/**
 * #8GB18R (b) and (c) — the services navigator and the forms search page both read a registry
 * that tells them when it was answered from the in-bundle catalogue, and both threw that away.
 *
 * `useRegistryRecords` has exposed `degraded` since the 2026-09-16 outage, and
 * `SearchResultsHeaderBand` has had a `catalogueDegraded` prop since the first two surfaces
 * adopted it. Neither of these pages connected the two, so a reader scanning a seed-served list
 * of referral services or statutory forms was shown a confident count and nothing else.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormsSearchResultsPage } from "@/components/forms/forms-search-results-page";
import { ServicesNavigatorPage } from "@/components/services/services-navigator-page";
import { formRecords } from "@/lib/forms";
import { loadServicesSnapshot } from "@/lib/service-catalog";
import { mapCatalogToServiceRecords } from "@/lib/service-catalog-mapper";
import { catalogueDegradedNotice } from "@/lib/site-content/catalogue-seed-fallback";

const registry = vi.hoisted(() => ({ degraded: false }));
const serviceRecords = mapCatalogToServiceRecords(loadServicesSnapshot().services);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// One mock for both pages: the hook is shared, and so is the flag both pages were dropping.
vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecords: (kind: string) => ({
    status: "ready",
    records: kind === "form" ? formRecords : serviceRecords,
    total: kind === "form" ? formRecords.length : serviceRecords.length,
    verifiedCount: 0,
    demoMode: true,
    governance: {},
    degraded: registry.degraded,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/use-result-sort", () => ({
  useResultSort: () => ["relevance", vi.fn()] as const,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    favourites: { service: [], form: [], differential: [] },
    ready: true,
    loadError: null,
    error: null,
    isAuthenticated: false,
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
    clearFavourites: vi.fn(async () => true),
    reload: vi.fn(),
  }),
}));

afterEach(() => {
  registry.degraded = false;
  window.history.replaceState(null, "", "/");
  cleanup();
});

describe("services navigator says when the registry may be stale", () => {
  it("carries the shared notice on the count band", () => {
    registry.degraded = true;
    window.history.replaceState(null, "", "/services?q=crisis");
    render(<ServicesNavigatorPage />);

    expect(screen.getAllByText(new RegExp(catalogueDegradedNotice, "i")).length).toBeGreaterThan(0);
  });

  it("says nothing when the published registry was read normally", () => {
    window.history.replaceState(null, "", "/services?q=crisis");
    render(<ServicesNavigatorPage />);

    expect(screen.queryByText(new RegExp(catalogueDegradedNotice, "i"))).toBeNull();
  });
});

describe("forms search says when the registry may be stale", () => {
  it("carries the shared notice on the count band", () => {
    registry.degraded = true;
    window.history.replaceState(null, "", "/forms/search?q=transport");
    render(<FormsSearchResultsPage query="transport" />);

    expect(screen.getAllByText(new RegExp(catalogueDegradedNotice, "i")).length).toBeGreaterThan(0);
  });

  it("says nothing when the published registry was read normally", () => {
    window.history.replaceState(null, "", "/forms/search?q=transport");
    render(<FormsSearchResultsPage query="transport" />);

    expect(screen.queryByText(new RegExp(catalogueDegradedNotice, "i"))).toBeNull();
  });
});
