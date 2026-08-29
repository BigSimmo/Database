import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";

const favouritesHook = vi.hoisted(() => ({
  items: [] as Array<{
    id: string;
    type: "note" | "source" | "set" | "service" | "form";
    title: string;
    meta?: string;
    set?: string;
    keywords: string;
  }>,
  status: "ready" as "ready" | "loading" | "partial" | "error" | "unauthorized",
  registryStatus: "ready" as "ready" | "loading" | "partial" | "error" | "unauthorized",
  refetch: () => undefined,
}));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => favouritesHook,
}));

describe("FavouritesHub unavailable controls", () => {
  beforeEach(() => {
    favouritesHook.items = [];
    favouritesHook.status = "ready";
    favouritesHook.registryStatus = "ready";
  });

  it("keeps unavailable actions reachable and exposes their reasons", () => {
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const recent = screen.getByRole("button", { name: "Recent" });
    const add = screen.getByRole("button", { name: /Add favourite/ });
    const newSet = screen.getByRole("button", { name: "New set" });

    // `aria-disabled`, never the native attribute: `disabled` removes the tab
    // stop, so the description each of these carries would be written and then
    // never reached by a keyboard user. See docs/wiring-conventions.md.
    for (const control of [recent, add, newSet]) {
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).not.toBeDisabled();
    }
    expect(recent).toHaveAccessibleDescription("Additional sort options are coming soon.");
    expect(add).toHaveAccessibleDescription("Adding favourites from this screen is coming soon.");
    expect(newSet).toHaveAccessibleDescription("Creating favourite sets is coming soon.");
  });

  it("lets the keyboard reach an unavailable action, and does nothing when it is activated", async () => {
    const user = userEvent.setup();
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const add = screen.getByRole("button", { name: /Add favourite/ });

    // The whole point of the conversion: focus lands on it. `.focus()` would
    // pass on a natively disabled button in jsdom, so tab to it for real — that
    // is the assertion nothing pinned before, and it is what regressed when the
    // native attribute was there.
    add.focus();
    expect(add).toHaveFocus();
    await user.tab();
    expect(add).not.toHaveFocus();
    await user.tab({ shift: true });
    expect(add).toHaveFocus();

    // Focusable must not mean operable. Activating by keyboard and by pointer
    // both no-op, and the accessible description is what the user gets instead.
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(add);
    expect(add).toHaveAccessibleDescription("Adding favourites from this screen is coming soon.");
    expect(screen.getByTestId("favourites-hub")).toBeInTheDocument();
  });

  it("does not assert library zeroes while the saved registry is still loading", () => {
    favouritesHook.status = "loading";
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const hub = screen.getByTestId("favourites-hub");
    expect(within(hub).getByText("Loading your favourites")).toBeInTheDocument();
    // SPEC §11: the tile states the count is unknown rather than showing a dash, which in a
    // numeric tile reads as zero. The test's subject is unchanged — no library zero is asserted.
    expect(within(hub).getByLabelText("Items unavailable until favourites finish loading")).toHaveTextContent(
      "Unknown",
    );
    expect(within(hub).getByLabelText("Sets unavailable until favourites finish loading")).toHaveTextContent("Unknown");
    // Filters is local UI state, not library inventory — a zero there is honest.
    expect(within(hub).getByText("Filters").parentElement?.parentElement).toHaveTextContent("0");
    expect(within(hub).getByRole("button", { name: "Choose favourite type" })).toHaveTextContent("All");
    expect(within(hub).getByRole("button", { name: "Choose favourite type" })).not.toHaveTextContent("·");
  });

  it("does not assert library zeroes after the saved registry fails", () => {
    favouritesHook.status = "error";
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const hub = screen.getByTestId("favourites-hub");
    expect(within(hub).getByText("Could not load your favourites")).toBeInTheDocument();
    expect(within(hub).getByLabelText("Items unavailable because favourites could not be loaded")).toHaveTextContent(
      "Unknown",
    );
    expect(within(hub).getByLabelText("Sets unavailable because favourites could not be loaded")).toHaveTextContent(
      "Unknown",
    );
    expect(within(hub).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(hub).queryByText("All · 0")).not.toBeInTheDocument();
  });

  it("labels counts as partial when some saved sources fail", () => {
    favouritesHook.items = [
      {
        id: "service:loaded",
        type: "service",
        title: "Loaded service",
        set: "Saved services",
        keywords: "loaded service",
      },
    ];
    favouritesHook.status = "partial";

    render(<FavouritesHub query="not-loaded" onClearQuery={() => undefined} demoMode={false} />);

    const hub = screen.getByTestId("favourites-hub");
    expect(within(hub).getByRole("status")).toHaveTextContent(
      "Some saved sources are unavailable. Counts include the favourites that loaded successfully.",
    );
    expect(within(hub).getByText("Items").parentElement?.parentElement).toHaveTextContent("1");
    expect(within(hub).getByText("No loaded favourites match")).toBeInTheDocument();
    expect(within(hub).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
