import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Several preferences persist locally but have no behavior consumer yet. Keep
// that limitation explicit without repeating the same warning in every row:
// wholly inert sections share one visible, accessible note; an isolated inert
// row keeps its own concise marker.

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

const CLINICAL_NOTE = "Saved on this device; not yet used in answers.";
const NOTIFICATIONS_NOTE = "Saved on this device; notifications are not available yet.";
const NOT_YET_ACTIVE_TEXT = "Not active yet";

const CLINICAL_ROWS = ["settings-row-jurisdiction", "settings-row-default-population", "settings-row-answer-style"];

const NOTIFICATION_ROWS = [
  "settings-row-guideline-updates",
  "settings-row-product-news",
  "settings-row-saved-item-changes",
];

const FUNCTIONAL_ROWS = [
  "settings-row-appearance",
  "settings-row-interface-density",
  // Tri-state segmented control since 2026-08-17 ("System / Reduced / Full"), so
  // the row id follows the "Motion" label rather than the old boolean toggle.
  "settings-row-motion",
  // Wired 2026-07-19: landing → shell mode redirect, recents → SharedHomeEmptyState
  // gate, compact citations → source-capsule label.
  "settings-row-default-landing-view",
  "settings-row-recent-searches-on-home",
  "settings-row-compact-citations",
];

function renderDialog() {
  return render(
    <SettingsDialog
      open
      onClose={() => {}}
      identity={{ displayName: "Local session", initials: "LS", detail: "Browser only", signedIn: true }}
      onSignOut={() => {}}
      onOpenGuide={() => {}}
    />,
  );
}

describe("settings dialog inert-preference honesty markers", () => {
  it("uses one concise note for each wholly inactive section", () => {
    renderDialog();
    expect(screen.getAllByText(CLINICAL_NOTE)).toHaveLength(1);
    expect(screen.getAllByText(NOTIFICATIONS_NOTE)).toHaveLength(1);
    expect(screen.getAllByText(NOT_YET_ACTIVE_TEXT)).toHaveLength(1);
    expect(
      within(screen.getByTestId("settings-row-saved-protocols-on-home")).getByText(NOT_YET_ACTIVE_TEXT),
    ).toBeVisible();
  });

  it("keeps the functional appearance, density, and motion rows unmarked", () => {
    renderDialog();
    for (const testId of FUNCTIONAL_ROWS) {
      const row = screen.getByTestId(testId);
      expect(within(row).queryByText(NOT_YET_ACTIVE_TEXT)).not.toBeInTheDocument();
    }
  });

  it("announces each shared section limitation from its controls", () => {
    renderDialog();
    for (const testId of CLINICAL_ROWS) {
      const row = screen.getByTestId(testId);
      const control =
        within(row).queryByRole("combobox") ?? within(row).queryByRole("radiogroup") ?? within(row).getByRole("switch");
      const describedBy = control?.getAttribute("aria-describedby");
      expect(describedBy, `${testId} control must reference the clinical section note`).toBe(
        "settings-clinical-defaults-note",
      );
      const description = document.getElementById(describedBy as string);
      expect(description).toHaveTextContent(CLINICAL_NOTE);
    }
    for (const testId of NOTIFICATION_ROWS) {
      const control = within(screen.getByTestId(testId)).getByRole("switch");
      expect(control).toHaveAttribute("aria-describedby", "settings-notifications-note");
      expect(document.getElementById("settings-notifications-note")).toHaveTextContent(NOTIFICATIONS_NOTE);
    }
  });

  it("keeps the isolated saved-protocol preference tied to its row marker", () => {
    renderDialog();
    const row = screen.getByTestId("settings-row-saved-protocols-on-home");
    const control = within(row).getByRole("switch");
    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(NOT_YET_ACTIVE_TEXT);
  });

  it("does not attach the inert description to functional controls", () => {
    renderDialog();
    for (const testId of FUNCTIONAL_ROWS) {
      const row = screen.getByTestId(testId);
      const control =
        within(row).queryByRole("combobox") ?? within(row).queryByRole("radiogroup") ?? within(row).getByRole("switch");
      expect(control?.getAttribute("aria-describedby") ?? null).toBeNull();
    }
  });
});
