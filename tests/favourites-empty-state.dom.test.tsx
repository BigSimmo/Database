import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FavouritesCommandLibraryPage } from "@/components/clinical-dashboard/favourites-command-library-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "authenticated",
    session: { user: { email: "clinician@example.test" } },
    isConfigured: true,
    error: null,
  }),
}));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => ({
    items: [],
    status: "ready",
    registryStatus: "ready",
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/clinical-dashboard/search-command-context", () => ({
  useSearchCommand: () => null,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

describe("favourites empty rendering", () => {
  it("renders one no-match state and one related status region across responsive layouts", () => {
    render(<FavouritesCommandLibraryPage query="" demoMode={false} />);

    expect(screen.getAllByTestId("favourites-empty-matches")).toHaveLength(1);
    expect(screen.getAllByText("No favourites match")).toHaveLength(1);
    expect(
      screen.getAllByRole("status").filter((status) => status.textContent?.includes("No favourites match")),
    ).toHaveLength(1);
  });

  it("uses Set and Type facets while keeping Recently used outside the filter count", async () => {
    const user = userEvent.setup();
    render(<FavouritesCommandLibraryPage query="" demoMode />);

    expect(screen.queryByTestId("favourites-filter-rail")).toBeNull();
    const trigger = screen.getByTestId("favourites-filter-trigger-phone");
    expect(trigger).toHaveAccessibleName(/No filters active/);

    await user.click(trigger);
    const panel = screen.getByTestId("favourites-filter-panel");
    expect(within(panel).getByRole("button", { name: "Set" })).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).getByRole("button", { name: "Type" })).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).getByRole("button", { name: "Pinned" })).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).getByRole("button", { name: "Source support" })).toHaveAttribute("aria-expanded", "false");

    await user.click(within(panel).getByRole("button", { name: "Pinned" }));
    await user.click(within(panel).getByRole("button", { name: /^Pinned only \(/ }));
    expect(trigger).toHaveAccessibleName(/1 filter active/);
    await user.click(within(panel).getByTestId("favourites-filter-panel-done"));
    expect(screen.getByRole("button", { name: "Remove Status: Pinned filter" })).toBeVisible();

    const recent = screen.getByRole("button", { name: "Recently used" });
    await user.click(recent);
    expect(recent).toHaveAttribute("aria-pressed", "true");
    expect(trigger).toHaveAccessibleName(/1 filter active/);
  });
});
