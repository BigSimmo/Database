import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => [],
}));

describe("FavouritesHub unavailable controls", () => {
  it("keeps unavailable actions natively disabled and exposes their reasons", () => {
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const recent = screen.getByRole("button", { name: "Recent" });
    const add = screen.getByRole("button", { name: /Add favourite/ });
    const newSet = screen.getByRole("button", { name: "New set" });

    expect(recent).toBeDisabled();
    expect(recent).not.toHaveAttribute("aria-disabled");
    expect(recent).toHaveAccessibleDescription("Additional sort options are coming soon.");
    expect(add).toBeDisabled();
    expect(add).not.toHaveAttribute("aria-disabled");
    expect(add).toHaveAccessibleDescription("Adding favourites from this screen is coming soon.");
    expect(newSet).toBeDisabled();
    expect(newSet).not.toHaveAttribute("aria-disabled");
    expect(newSet).toHaveAccessibleDescription("Creating favourite sets is coming soon.");
  });
});
