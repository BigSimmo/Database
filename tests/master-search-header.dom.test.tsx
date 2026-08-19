/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    session: null,
    isConfigured: true,
    error: null,
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => ({
    items: [],
    status: "ready",
    registryStatus: "ready",
    refetch: () => undefined,
  }),
}));

vi.mock("@/components/clinical-dashboard/search-command-context", () => ({
  useSearchCommand: () => null,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

function defaultHeaderProps() {
  return {
    demoMode: false,
    documents: [],
    query: "",
    searchMode: "answer" as const,
    loading: false,
    selectedDocumentIds: [] as string[],
    queryMode: "auto" as const,
    scopeFilters: {},
    realDataReady: true,
    canAccessFavourites: false,
    onQueryChange: vi.fn(),
    onSearchModeChange: vi.fn(),
    onAsk: vi.fn(),
    onClearQuery: vi.fn(),
    onClearScope: vi.fn(),
    onQueryModeChange: vi.fn(),
    onScopeFiltersChange: vi.fn(),
    onToggleScope: vi.fn(),
    queryModeOptions: [{ value: "auto" as const, label: "Auto" }],
  };
}

describe("MasterSearchHeader DOM", () => {
  beforeEach(() => {
    installMatchMediaStub(false);
    vi.clearAllMocks();
  });

  describe("#WJDQ0X - privacy notice landmark / role=group wrapping", () => {
    it("wraps the composer privacy notice in role='group' with aria-label='Search privacy notice'", () => {
      render(<MasterSearchHeader {...defaultHeaderProps()} />);

      const privacyGroup = screen.getByRole("group", { name: "Search privacy notice" });
      expect(privacyGroup).toBeInTheDocument();

      const warningNotice = screen.getByTestId("answer-composer-privacy-warning");
      expect(warningNotice).toBeInTheDocument();
      expect(privacyGroup).toContainElement(warningNotice);
      expect(within(privacyGroup).getByText("Do not enter patient-identifiable information.")).toBeInTheDocument();
      expect(within(privacyGroup).getByRole("link", { name: "Privacy and data processing" })).toBeInTheDocument();
    });
  });

  describe("#D8JBCV - mobile /tools home privacy notice in footer placement", () => {
    it("shows the privacy notice on desktop layout regardless of mobileHomeComposerPlacement", () => {
      installMatchMediaStub(false);

      const { rerender } = render(
        <MasterSearchHeader {...defaultHeaderProps()} searchMode="tools" mobileHomeComposerPlacement="hero" />,
      );
      expect(screen.getByRole("group", { name: "Search privacy notice" })).toBeInTheDocument();

      rerender(
        <MasterSearchHeader {...defaultHeaderProps()} searchMode="tools" mobileHomeComposerPlacement="footer" />,
      );
      expect(screen.getByRole("group", { name: "Search privacy notice" })).toBeInTheDocument();
    });

    it("displays the patient-privacy warning on mobile layout when mobileHomeComposerPlacement is 'footer' (/tools)", () => {
      // Emulate mobile phone screen width (< 640px)
      installMatchMediaStub(true);

      render(
        <MasterSearchHeader
          {...defaultHeaderProps()}
          searchMode="tools"
          mobileSearchPlacement="bottom"
          mobileHomeComposerPlacement="footer"
        />,
      );

      const privacyGroup = screen.getByRole("group", { name: "Search privacy notice" });
      expect(privacyGroup).toBeInTheDocument();
      expect(screen.getByTestId("answer-composer-privacy-warning")).toBeInTheDocument();
    });

    it("suppresses the privacy notice on mobile bottom dock when mobileHomeComposerPlacement is 'hero' and not home hero slot", () => {
      // Emulate mobile phone screen width (< 640px)
      installMatchMediaStub(true);

      render(
        <MasterSearchHeader
          {...defaultHeaderProps()}
          searchMode="prescribing"
          mobileSearchPlacement="bottom"
          mobileHomeComposerPlacement="hero"
        />,
      );

      expect(screen.queryByRole("group", { name: "Search privacy notice" })).toBeNull();
      expect(screen.queryByTestId("answer-composer-privacy-warning")).toBeNull();
    });
  });
});
