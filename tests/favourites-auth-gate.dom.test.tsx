/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import userEvent from "@testing-library/user-event";

import { ClinicalSidebarContent, deriveSidebarIdentity } from "@/components/clinical-dashboard/ClinicalSidebar";
import { FavouritesCommandLibraryPage } from "@/components/clinical-dashboard/favourites-command-library-page";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { ApplicationsLauncherWorkspace } from "@/components/applications-launcher-page";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { filterCrossModesForSession, visibleAppModeDefinitionsForSession } from "@/lib/app-modes";
import { toolCatalogRecordsForSession } from "@/lib/tools-catalog";

const authSession = vi.hoisted(() => ({
  status: "signed_out" as string,
  session: null as { user: { email?: string } } | null,
  isConfigured: true,
  error: null as string | null,
  signInWithEmail: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => authSession,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => [],
}));

vi.mock("@/components/clinical-dashboard/search-command-context", () => ({
  useSearchCommand: () => null,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

function sidebarProps(showAccountLibrary: boolean) {
  return {
    recentQueries: [] as string[],
    identity: deriveSidebarIdentity(showAccountLibrary ? "clinician@clinic.example" : null),
    activeMode: "answer" as const,
    showAccountLibrary,
    onNewChat: () => undefined,
    onPickRecent: () => undefined,
    onOpenGuide: () => undefined,
    onOpenSettings: () => undefined,
    onOpenAccount: () => undefined,
    theme: "light" as const,
    onToggleTheme: () => undefined,
  };
}

function headerProps(canAccessFavourites: boolean) {
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
    canAccessFavourites,
    onQueryChange: () => undefined,
    onSearchModeChange: vi.fn(),
    onAsk: () => undefined,
    onClearQuery: () => undefined,
    onClearScope: () => undefined,
    onQueryModeChange: () => undefined,
    onScopeFiltersChange: () => undefined,
    onToggleScope: () => undefined,
    queryModeOptions: [{ value: "auto" as const, label: "Auto" }],
  };
}

describe("favourites auth gate DOM", () => {
  beforeEach(() => {
    authSession.status = "signed_out";
    authSession.session = null;
    authSession.error = null;
  });

  it("shows Your library with Favourites only when showAccountLibrary is true", () => {
    const { rerender } = render(<ClinicalSidebarContent {...sidebarProps(false)} />);

    expect(screen.queryByRole("navigation", { name: "Your library" })).toBeNull();
    expect(
      within(screen.getByRole("navigation", { name: "Tools" })).getByRole("link", { name: "Answer" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Favourites" })).toBeNull();

    rerender(<ClinicalSidebarContent {...sidebarProps(true)} />);

    expect(screen.getByRole("navigation", { name: "Your library" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Favourites" })).toHaveAttribute("href", "/favourites");
    expect(
      within(screen.getByRole("navigation", { name: "Tools" })).queryByRole("link", { name: "Favourites" }),
    ).toBeNull();
  });

  it("omits Favourites from session mode options when signed out and not demo", () => {
    expect(
      visibleAppModeDefinitionsForSession({ authenticated: false, demoMode: false }).map((mode) => mode.id),
    ).not.toContain("favourites");
  });

  it("gates the favourites library and opens signup with save-favourites copy when signed out", () => {
    authSession.status = "signed_out";
    render(<FavouritesCommandLibraryPage query="" demoMode={false} />);

    expect(screen.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    expect(screen.getByText(/Sign up to save favourites and access them across devices/i)).toBeVisible();
    expect(screen.getByTestId("favourites-open-account-setup")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sign up to save favourites" })).toBeVisible();
    expect(screen.getByTestId("favourites-command-library")).toBeInTheDocument();
  });

  it("keeps the interactive library available in demo mode without the signup gate", () => {
    authSession.status = "signed_out";
    render(<FavouritesCommandLibraryPage query="" demoMode={true} />);

    expect(screen.getByRole("heading", { name: "Favourites command library" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Sign up to save favourites" })).toBeNull();
    expect(screen.queryByTestId("favourites-open-account-setup")).toBeNull();
  });

  it("uses favourites intent copy on the account setup dialog", () => {
    render(<AccountSetupDialog open onClose={() => undefined} intent="favourites" />);

    expect(screen.getByRole("heading", { name: "Sign up to save favourites" })).toBeVisible();
    expect(screen.getByText(/Create an account to save clinical favourites/i)).toBeVisible();
    expect(screen.getByText("Saved favourites")).toBeVisible();
  });

  it("describes the actual account persistence and disables unavailable social sign-in", () => {
    render(<AccountSetupDialog open onClose={() => undefined} />);

    expect(screen.getByRole("heading", { name: "What your account saves" })).toBeVisible();
    expect(screen.getByText(/Recent questions stay in this browser session/i)).toBeVisible();
    expect(screen.getByText("Account-scoped saves")).toBeVisible();
    expect(screen.queryByText(/Everything syncs across your devices/i)).toBeNull();
    expect(screen.queryByText(/never shared/i)).toBeNull();

    for (const provider of ["Apple", "Google", "Microsoft"]) {
      const button = screen.getByRole("button", { name: `${provider} sign-in unavailable` });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", `${provider} sign-in is unavailable — coming soon`);
      expect(button).toHaveAccessibleDescription(`${provider} sign-in is unavailable. Continue with email.`);
    }
  });

  it("blacks out Tools Saved workflows and Favourites shortcuts for guests", () => {
    authSession.status = "signed_out";
    render(<ApplicationsLauncherWorkspace canAccessFavourites={false} />);

    expect(screen.queryByRole("button", { name: "Saved" })).toBeNull();
    expect(screen.queryByTestId("tool-shortcut-favourites")).toBeNull();
    expect(screen.queryByText("Saved workflows")).toBeNull();
    expect(screen.getByTestId("tools-hub")).toBeVisible();
  });

  it("keeps Tools Saved workflows available when Favourites access is granted", () => {
    render(<ApplicationsLauncherWorkspace canAccessFavourites={true} />);

    expect(screen.getByRole("button", { name: "Saved" })).toBeVisible();
    expect(screen.getByTestId("tool-shortcut-favourites")).toBeVisible();
    expect(
      toolCatalogRecordsForSession({ authenticated: true, demoMode: false }).some((t) => t.id === "favourites"),
    ).toBe(true);
    expect(filterCrossModesForSession(["favourites", "forms"], { authenticated: false, demoMode: false })).toEqual([
      "forms",
    ]);
  });

  it("omits Favourites from the mode menu for guests", async () => {
    const user = userEvent.setup();
    render(<MasterSearchHeader {...headerProps(false)} />);

    await user.click(screen.getByRole("button", { name: /Mode Answer/i }));
    const guestMenu = await screen.findByRole("menu", { name: "Choose app mode" });
    expect(within(guestMenu).queryByRole("menuitemradio", { name: /Favourites/i })).toBeNull();
    expect(within(guestMenu).getByRole("menuitemradio", { name: /Answer/i })).toBeTruthy();
  });

  it("keeps Favourites in the mode menu when access is granted", async () => {
    const user = userEvent.setup();
    render(<MasterSearchHeader {...headerProps(true)} />);

    await user.click(screen.getByRole("button", { name: /Mode Answer/i }));
    const signedInMenu = await screen.findByRole("menu", { name: "Choose app mode" });
    expect(within(signedInMenu).getByRole("menuitemradio", { name: /Favourites/i })).toBeTruthy();
  });

  it("does not label the mode trigger as Favourites for gated guest deep links", () => {
    render(<MasterSearchHeader {...headerProps(false)} searchMode="favourites" />);
    expect(screen.getByRole("button", { name: /Mode Answer/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mode Favourites/i })).toBeNull();
  });
});
