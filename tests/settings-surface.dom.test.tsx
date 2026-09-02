import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    isConfigured: false,
    error: null,
    notice: null,
    session: null,
    signInWithEmail: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    favourites: {},
    clearFavourites: vi.fn(async () => true),
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

import { SettingsDialog } from "@/components/clinical-dashboard/settings-dialog";

function renderDialog() {
  return render(
    <SettingsDialog
      open
      onClose={vi.fn()}
      identity={{ displayName: "Local session", initials: "LS", detail: "Browser only", signedIn: true }}
      onSignOut={vi.fn()}
      onOpenGuide={vi.fn()}
    />,
  );
}

afterEach(async () => {
  cleanup();
  // Sheet restores focus in requestAnimationFrame with one defensive retry.
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, 60));
  });
  vi.clearAllMocks();
});

describe("settings surface", () => {
  it("keeps the compact phone title while gating search and navigation to desktop", () => {
    renderDialog();

    const heading = screen.getByRole("heading", { name: "Account & app" });
    expect(heading).toBeVisible();
    expect(within(heading).getByText("Settings")).toHaveClass("md:hidden");
    expect(screen.getByText("Account and workspace preferences")).toHaveClass("md:hidden");

    const search = screen.getByRole("search");
    expect(search).toHaveClass("hidden", "md:block");
    expect(screen.getByTestId("settings-search-input")).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "Settings sections" });
    expect(navigation.closest("aside")).toHaveClass("hidden", "md:flex");
    expect(screen.queryByTestId("settings-section-chips")).not.toBeInTheDocument();
  });

  it("keeps every section and core setting directly available in the scroll", () => {
    renderDialog();

    for (const heading of [
      "Account",
      "Clinical defaults",
      "App preferences",
      "Personalisation",
      "Notifications",
      "Privacy & security",
      "Keyboard shortcuts",
      "Help & About",
      "Developer",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }

    expect(screen.getByTestId("settings-row-jurisdiction")).toBeVisible();
    expect(screen.getByTestId("settings-row-answer-style")).toBeVisible();
    expect(screen.getByTestId("settings-row-appearance")).toBeVisible();
    expect(screen.getByTestId("settings-row-save-recent-searches")).toBeVisible();
  });

  it("lists every keyboard shortcut the app binds", () => {
    renderDialog();
    const card = screen.getByTestId("settings-keyboard-shortcuts-card");

    expect(within(card).getByText("Focus search")).toBeVisible();
    expect(within(card).getByText("Open the command palette")).toBeVisible();
    expect(within(card).getByText("Ask the question you have typed")).toBeVisible();
    expect(within(card).getByText("Close this dialog")).toBeVisible();
    expect(within(card).getAllByText("Ctrl").length).toBe(2);
  });

  it("keeps recent-search privacy and preference-sync status explicit", () => {
    renderDialog();

    const privacyRow = screen.getByTestId("settings-row-save-recent-searches");
    expect(within(privacyRow).getByRole("switch", { name: "Save recent searches" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(privacyRow).queryByText("Not active yet")).not.toBeInTheDocument();

    const syncRow = screen.getByTestId("settings-row-preference-sync");
    expect(syncRow).toHaveAttribute("data-sync-state", "local-only");
    expect(syncRow).toHaveTextContent("Saved on this device");
  });
});
