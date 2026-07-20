import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The settings surface persists several preferences that nothing in the app
// consumes yet (audit 2026-07-19 P2: inert controls presented as live). Until a
// preference is actually read somewhere, its row must carry the explicit
// "Saved for later — not active yet" marker so a clinician never believes
// answer behavior changed. The functional rows (appearance/density/motion,
// which drive the html theme/data-density/data-motion hooks) must NOT carry it.
// When wiring a preference up, remove it from INERT_ROWS here and drop the
// notYetActive flag from its row in settings-dialog.tsx.

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

const NOT_YET_ACTIVE_TEXT = "Saved for later — not active yet";

const INERT_ROWS = [
  // Clinical trio: wiring these into answer generation is provider-eval-gated
  // (see AGENTS.md confirmation boundary) — they stay marked until that lands.
  "settings-row-jurisdiction",
  "settings-row-default-population",
  "settings-row-answer-style",
  // No saved-protocols module exists on the home surface yet.
  "settings-row-saved-protocols-on-home",
  // No notification delivery infrastructure exists yet.
  "settings-row-guideline-updates",
  "settings-row-product-news",
  "settings-row-saved-item-changes",
];

const FUNCTIONAL_ROWS = [
  "settings-row-appearance",
  "settings-row-interface-density",
  "settings-row-reduce-motion",
  // Wired 2026-07-19: landing → shell mode redirect, recents → AnswerEmptyState
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
  it("marks every preference no consumer reads as not yet active", () => {
    renderDialog();
    for (const testId of INERT_ROWS) {
      const row = screen.getByTestId(testId);
      expect(within(row).getByText(NOT_YET_ACTIVE_TEXT)).toBeInTheDocument();
    }
    // Exactly the inert rows carry the marker — a count drift means a row was
    // added or wired up without updating this contract.
    expect(screen.getAllByText(NOT_YET_ACTIVE_TEXT)).toHaveLength(INERT_ROWS.length);
  });

  it("keeps the functional appearance, density, and motion rows unmarked", () => {
    renderDialog();
    for (const testId of FUNCTIONAL_ROWS) {
      const row = screen.getByTestId(testId);
      expect(within(row).queryByText(NOT_YET_ACTIVE_TEXT)).not.toBeInTheDocument();
    }
  });

  it("announces the inert status to assistive tech from every marked control", () => {
    // The badge must be part of each control's accessible description, not just
    // a visual sibling — a screen-reader user focusing the select, radiogroup,
    // or switch has to hear that the setting is not active yet.
    renderDialog();
    for (const testId of INERT_ROWS) {
      const row = screen.getByTestId(testId);
      const control =
        within(row).queryByRole("combobox") ?? within(row).queryByRole("radiogroup") ?? within(row).getByRole("switch");
      const describedBy = control?.getAttribute("aria-describedby");
      expect(describedBy, `${testId} control must reference its inert marker`).toBeTruthy();
      const description = document.getElementById(describedBy as string);
      expect(description).toHaveTextContent(NOT_YET_ACTIVE_TEXT);
    }
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
