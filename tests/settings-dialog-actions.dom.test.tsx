import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The settings surface owns the destructive privacy actions (clear recent
// searches, clear saved items), preference reset, and sign-out. These flows had
// no render coverage. The data/auth/account hooks are mocked (the same harness
// shape as settings-inert-preferences.dom.test.tsx) so the destructive wiring is
// asserted without real storage or auth; useTheme/useAppPreferences run
// unmocked in jsdom.

const { clearRecentQueries, clearFavourites, signInWithEmail, mockRecentCount, mockFavourites } = vi.hoisted(() => {
  let recentCount = 3;
  let favouritesData = { medications: [{ id: "m1" }] };
  return {
    clearRecentQueries: vi.fn(),
    clearFavourites: vi.fn(async () => true),
    signInWithEmail: vi.fn(),
    mockRecentCount: {
      get: () => recentCount,
      set: (count: number) => {
        recentCount = count;
      },
    },
    mockFavourites: {
      get: () => favouritesData,
      set: (data: { medications: Array<{ id: string }> }) => {
        favouritesData = data;
      },
    },
  };
});

vi.mock("@/lib/recent-query-storage", () => ({
  clearRecentQueries: () => clearRecentQueries(),
  // Non-zero so the "Clear recent searches" action is enabled by default.
  countRecentQueries: () => mockRecentCount.get(),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    // One saved item so the "Clear saved items" action is enabled by default.
    favourites: mockFavourites.get(),
    clearFavourites,
    isSaved: () => false,
    setFavourite: vi.fn(async () => true),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    // Configured so the email sign-in submit is enabled; irrelevant to the
    // signed-in destructive-action tests (which never render the sign-in form).
    isConfigured: true,
    error: null,
    notice: null,
    session: null,
    signInWithEmail,
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import { SettingsDialog } from "@/components/clinical-dashboard/settings-dialog";

function renderDialog(identityOverrides: Record<string, unknown> = {}) {
  const onSignOut = vi.fn();
  render(
    <SettingsDialog
      open
      onClose={vi.fn()}
      identity={{
        displayName: "Local session",
        initials: "LS",
        detail: "Browser only",
        signedIn: true,
        ...identityOverrides,
      }}
      onSignOut={onSignOut}
      onOpenGuide={vi.fn()}
    />,
  );
  return { onSignOut };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsDialog — destructive and account actions", () => {
  it("clears recent searches through the privacy action", () => {
    renderDialog();
    const button = screen.getByRole("button", { name: "Clear recent searches" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(clearRecentQueries).toHaveBeenCalledTimes(1);
  });

  it("disables clear recent searches when there are no recent queries", () => {
    mockRecentCount.set(0);
    renderDialog();
    const button = screen.getByRole("button", { name: "Clear recent searches" });
    expect(button).toBeDisabled();
    mockRecentCount.set(3); // Reset for other tests
  });

  it("clears saved items and confirms via a status notice", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Clear saved items" }));
    expect(clearFavourites).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Saved items cleared.")).toBeVisible();
  });

  it("signs out through the account action", () => {
    const { onSignOut } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("signs in with an entered email address", () => {
    renderDialog({ signedIn: false });
    // "Sign in" (rendered in both the desktop and mobile button sets) opens the
    // email entry form.
    fireEvent.click(screen.getAllByRole("button", { name: "Sign in" })[0]);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "clinician@clinic.example" },
    });
    const submit = screen.getByRole("button", { name: "Continue with email" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(signInWithEmail).toHaveBeenCalledWith("clinician@clinic.example");
  });
});
