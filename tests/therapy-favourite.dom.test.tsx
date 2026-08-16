import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("retries the same save intent after a failed mutation", async () => {
    accountState.authenticated = true;
    accountState.setFavourite.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<ResultCard therapy={therapy} />);

    const saveButton = screen.getByRole("button", { name: `Save ${therapy.name} to favourites` });
    await user.click(saveButton);
    expect(await screen.findByRole("status")).toHaveTextContent("Save failed. Try again.");

    await user.click(saveButton);

    expect(accountState.setFavourite).toHaveBeenNthCalledWith(1, "therapy", therapy.slug, true);
    expect(accountState.setFavourite).toHaveBeenNthCalledWith(2, "therapy", therapy.slug, true);
    expect(await screen.findByRole("status")).toHaveTextContent("Therapy saved.");
  });

  it("preserves the final intent across rapid opposite favourite toggles", async () => {
    accountState.authenticated = true;
    const pending: Array<{ saved: boolean; resolve: (value: boolean) => void }> = [];
    accountState.setFavourite.mockImplementation(
      (_kind, _slug, saved) =>
        new Promise<boolean>((resolve) => {
          pending.push({ saved, resolve });
        }),
    );
    render(<ResultCard therapy={therapy} />);

    const saveButton = screen.getByRole("button", { name: `Save ${therapy.name} to favourites` });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(accountState.setFavourite).toHaveBeenCalledTimes(2);
    expect(pending.map((mutation) => mutation.saved)).toEqual([true, false]);

    await act(async () => pending[0]?.resolve(true));
    await act(async () => pending[1]?.resolve(true));
    expect(await screen.findByRole("status")).toHaveTextContent("Therapy removed from saved items.");
  });
});
