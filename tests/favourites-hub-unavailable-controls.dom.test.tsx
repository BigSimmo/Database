import { render, screen, within } from "@testing-library/react";
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
  status: "ready" as "ready" | "loading" | "error" | "unauthorized",
  registryStatus: "ready" as "ready" | "loading" | "error" | "unauthorized",
  sourceStatus: "ready" as "ready" | "loading" | "error" | "unauthorized",
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
    favouritesHook.sourceStatus = "ready";
    favouritesHook.refetch = () => undefined;
  });

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

  it("does not assert library zeroes while the saved registry is still loading", () => {
    favouritesHook.status = "loading";
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    const hub = screen.getByTestId("favourites-hub");
    expect(within(hub).getByText("Loading your favourites")).toBeInTheDocument();
    expect(within(hub).getByLabelText("Items unavailable until favourites finish loading")).toHaveTextContent("—");
    expect(within(hub).getByLabelText("Sets unavailable until favourites finish loading")).toHaveTextContent("—");
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
      "—",
    );
    expect(within(hub).getByLabelText("Sets unavailable because favourites could not be loaded")).toHaveTextContent(
      "—",
    );
    expect(within(hub).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(hub).queryByText("All · 0")).not.toBeInTheDocument();
  });

  it("keeps loaded demo counts honest while warning about a partial registry failure", () => {
    const refetch = vi.fn();
    favouritesHook.status = "error";
    favouritesHook.registryStatus = "error";
    favouritesHook.sourceStatus = "error";
    favouritesHook.refetch = refetch;
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode />);

    const hub = screen.getByTestId("favourites-hub");
    expect(within(hub).getByTestId("favourites-partial-source-notice")).toHaveTextContent(
      "Some saved sources could not be loaded",
    );
    expect(within(hub).getByText("Items").parentElement).not.toHaveTextContent("—");
    within(hub).getByRole("button", { name: "Retry unavailable sources" }).click();
    expect(refetch).toHaveBeenCalledOnce();
  });
});
