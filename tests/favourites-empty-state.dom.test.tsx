import { render, screen } from "@testing-library/react";
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

describe("favourites empty rendering", () => {
  it("renders one no-match state and one related status region across responsive layouts", () => {
    render(<FavouritesCommandLibraryPage query="" demoMode={false} />);

    expect(screen.getAllByTestId("favourites-empty-matches")).toHaveLength(1);
    expect(screen.getAllByText("No favourites match")).toHaveLength(1);
    expect(
      screen.getAllByRole("status").filter((status) => status.textContent?.includes("No favourites match")),
    ).toHaveLength(1);
  });
});
