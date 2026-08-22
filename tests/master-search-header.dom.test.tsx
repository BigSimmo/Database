/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { ClinicalAskComposerActions } from "@/components/clinical-dashboard/clinical-ask-composer-actions";
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

const speech = vi.hoisted(() => ({
  state: "idle" as const,
  transcript: "",
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  clear: vi.fn(),
}));
vi.mock("@/components/clinical-dashboard/use-clinical-ask-speech", () => ({ useClinicalAskSpeech: () => speech }));

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
    (speech as { state: string }).state = "idle";
  });

  it("keeps Search submit separate from the explicit Clinical Ask action", () => {
    const props = defaultHeaderProps();
    props.query = "synthetic question";
    const onClinicalAsk = vi.fn();
    render(
      <MasterSearchHeader
        {...props}
        searchMode="services"
        clinicalAskActions={
          <button type="button" onClick={onClinicalAsk}>
            Ask Services
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask Services" }));
    expect(onClinicalAsk).toHaveBeenCalledOnce();
    expect(props.onAsk).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("search"));
    expect(props.onAsk).toHaveBeenCalledOnce();
  });

  it("blocks only Clinical Ask and microphone for identifier-shaped drafts", () => {
    const onAsk = vi.fn();
    render(
      <>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onAsk();
          }}
        >
          <button type="submit">Search</button>
        </form>
        <ClinicalAskComposerActions
          mode="services"
          draft="email test@example.com"
          active={false}
          offline={false}
          onDraftChange={vi.fn()}
          onAsk={vi.fn()}
        />
      </>,
    );
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ask Services" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dictate question for Services" })).toBeDisabled();
    expect(screen.getByText(/Remove identifiable details/)).not.toHaveTextContent("test@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onAsk).toHaveBeenCalledOnce();
  });

  it("leaves Search available offline and explains why only Clinical Ask is disabled", () => {
    render(
      <ClinicalAskComposerActions
        mode="services"
        draft="synthetic question"
        active={false}
        offline
        onDraftChange={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Ask Services" })).toBeDisabled();
    expect(screen.getByText("Clinical Ask needs the server evidence path.")).toBeInTheDocument();
  });

  it("renders no Clinical Ask controls when a mode does not supply them", () => {
    render(<MasterSearchHeader {...defaultHeaderProps()} searchMode="prescribing" />);
    expect(screen.queryByRole("button", { name: /^Ask / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dictate question/ })).not.toBeInTheDocument();
  });

  it("announces transient asking and recording states with disabled controls", () => {
    const onClinicalAsk = vi.fn();
    const { rerender } = render(
      <ClinicalAskComposerActions
        mode="services"
        draft="synthetic"
        active
        offline={false}
        onDraftChange={vi.fn()}
        onAsk={onClinicalAsk}
      />,
    );
    expect(screen.getByRole("button", { name: "Ask Services" })).toBeDisabled();
    expect(screen.getByText("Asking…")).toBeInTheDocument();
    (speech as { state: string }).state = "listening";
    rerender(
      <ClinicalAskComposerActions
        mode="services"
        draft="synthetic"
        active={false}
        offline={false}
        onDraftChange={vi.fn()}
        onAsk={onClinicalAsk}
      />,
    );
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(speech.stop).toHaveBeenCalledOnce();
    expect(onClinicalAsk).not.toHaveBeenCalled();
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
