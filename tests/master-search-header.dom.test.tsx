/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { factsheetsTopicsHref } from "@/lib/app-modes";
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

  it("disables the query input when private answer search is not ready", () => {
    render(<MasterSearchHeader {...defaultHeaderProps()} realDataReady={false} />);
    const input = screen.getByTestId("global-search-input");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("title", "Search setup not ready");
  });

  it("disables the query input for documents search when live data is not ready", () => {
    render(<MasterSearchHeader {...defaultHeaderProps()} searchMode="documents" realDataReady={false} />);
    const input = screen.getByTestId("global-search-input");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("title", "Search setup not ready");
  });

  it("keeps the query input enabled for local forms search when live data is not ready", () => {
    render(<MasterSearchHeader {...defaultHeaderProps()} searchMode="forms" realDataReady={false} />);
    expect(screen.getByTestId("global-search-input")).toBeEnabled();
  });

  it("keeps ordinary Search as the only composer action for former Clinical Ask modes", () => {
    const props = defaultHeaderProps();
    props.query = "synthetic question";
    const modes = [
      "services",
      "forms",
      "differentials",
      "formulation",
      "dsm",
      "specifiers",
      "therapy-compass",
    ] as const;
    const { rerender } = render(<MasterSearchHeader {...props} searchMode={modes[0]} />);

    for (const searchMode of modes) {
      rerender(<MasterSearchHeader {...props} searchMode={searchMode} />);
      expect(screen.queryByRole("button", { name: /^Ask / })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Dictate question|Stop recording/ })).not.toBeInTheDocument();
      expect(document.querySelector("[data-clinical-ask-actions]")).toBeNull();
    }

    fireEvent.submit(screen.getByRole("search"));
    expect(props.onAsk).toHaveBeenCalledOnce();
  });

  it("shows a governed Smart cue only when the server capability and intent both allow it", () => {
    const props = {
      ...defaultHeaderProps(),
      query: "Which service is best for ongoing support after discharge?",
      searchMode: "services" as const,
    };
    const { rerender } = render(<MasterSearchHeader {...props} clinicalAskAvailable />);

    expect(screen.getByTestId("smart-search-intent-cue")).toHaveTextContent("Smart answer");
    expect(screen.getByRole("button", { name: "Get Smart answer" })).toBeInTheDocument();
    expect(screen.getByText("Smart answer selected for Services.")).toBeInTheDocument();

    rerender(<MasterSearchHeader {...props} clinicalAskAvailable={false} />);
    expect(screen.queryByTestId("smart-search-intent-cue")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get Smart answer" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("smart-search-rotating-text")).not.toBeInTheDocument();
  });

  it("routes Factsheets Browse all sheets to the Topics page", async () => {
    const user = userEvent.setup();
    render(<MasterSearchHeader {...defaultHeaderProps()} searchMode="factsheets" />);

    await user.click(screen.getByRole("button", { name: "Open factsheets options" }));
    await user.click(screen.getByRole("button", { name: "Browse all sheets" }));

    expect(router.push).toHaveBeenCalledWith(factsheetsTopicsHref);
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

    it("omits the privacy notice on a footer-configured /tools result dock with no home slot", () => {
      // Emulate mobile phone screen width (< 640px). A tools result route carries
      // mobileHomeComposerPlacement="footer" but no desktop home composer slot, so
      // the result dock must omit the notice to keep maximum content space.
      installMatchMediaStub(true);

      render(
        <MasterSearchHeader
          {...defaultHeaderProps()}
          searchMode="tools"
          mobileSearchPlacement="bottom"
          mobileHomeComposerPlacement="footer"
        />,
      );

      expect(screen.queryByRole("group", { name: "Search privacy notice" })).toBeNull();
      expect(screen.queryByTestId("answer-composer-privacy-warning")).toBeNull();
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
