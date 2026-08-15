import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Therapy } from "@/components/therapy-compass/data/types";

const accountState = vi.hoisted(() => ({
  authenticated: false,
  setFavourite: vi.fn<(kind: "therapy", slug: string, saved: boolean) => Promise<boolean>>(),
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isAuthenticated: accountState.authenticated,
    isSaved: () => false,
    setFavourite: accountState.setFavourite,
  }),
}));

vi.mock("@/components/therapy-compass/bindings", () => ({
  useTcBindings: () => ({
    search: { query: "CBT", tags: [] },
    isInCompare: () => false,
    open: vi.fn(),
    openSheet: vi.fn(),
    toggleCompare: vi.fn(),
  }),
}));

import { ResultCard } from "@/components/therapy-compass/therapy-card";

const therapy = {
  slug: "cognitive-behavioural-therapy",
  name: "Cognitive behavioural therapy",
  aliases: ["CBT"],
  tags: ["CBT"],
  category: "Behavioural",
  reviewStatus: "needs_review",
  briefInterventionAvailable: true,
  patientSheetAvailable: true,
} as Therapy;

describe("Therapy favourite feedback", () => {
  afterEach(() => {
    accountState.authenticated = false;
    accountState.setFavourite.mockReset();
  });

  it("announces the sign-in requirement when a signed-out save is rejected", async () => {
    accountState.setFavourite.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<ResultCard therapy={therapy} />);

    await user.click(screen.getByRole("button", { name: `Save ${therapy.name} to favourites` }));

    expect(await screen.findByRole("status")).toHaveTextContent("Sign in or create an account to save therapies.");
  });

  it("announces a mutation failure for an authenticated account", async () => {
    accountState.authenticated = true;
    accountState.setFavourite.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<ResultCard therapy={therapy} />);

    await user.click(screen.getByRole("button", { name: `Save ${therapy.name} to favourites` }));

    expect(await screen.findByRole("status")).toHaveTextContent("Save failed. Try again.");
  });
});
