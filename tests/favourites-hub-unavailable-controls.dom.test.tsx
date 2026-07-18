import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => [],
}));

describe("FavouritesHub unavailable controls", () => {
  it("keeps unavailable actions focusable and exposes their reasons", () => {
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const recent = screen.getByRole("button", { name: "Recent" });
    const add = screen.getByRole("button", { name: /Add favourite/ });
    const newSet = screen.getByRole("button", { name: "New set" });

    expect(recent).toBeEnabled();
    expect(recent).toHaveAttribute("aria-disabled", "true");
    expect(recent).toHaveAccessibleDescription("Additional sort options are coming soon.");
    expect(add).toBeEnabled();
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Adding favourites from this screen is coming soon.");
    expect(newSet).toBeEnabled();
    expect(newSet).toHaveAttribute("aria-disabled", "true");
    expect(newSet).toHaveAccessibleDescription("Creating favourite sets is coming soon.");

    for (const control of [recent, add, newSet]) {
      control.focus();
      expect(document.activeElement).toBe(control);
    }
  });
});
