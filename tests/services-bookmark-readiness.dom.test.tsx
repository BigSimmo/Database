import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { loadServicesSnapshot } from "@/lib/service-catalog";
import { mapCatalogToServiceRecords } from "@/lib/service-catalog-mapper";

const registryRecords = mapCatalogToServiceRecords(loadServicesSnapshot().services).slice(0, 3);

const accountState = vi.hoisted(() => ({ ready: true, loadError: null as string | null, saved: [] as string[] }));
const setFavourite = vi.hoisted(() => vi.fn(async () => true));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecords: () => ({
    status: "ready",
    records: registryRecords,
    total: registryRecords.length,
    demoMode: true,
    governance: {},
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/use-result-sort", () => ({
  useResultSort: () => ["relevance", vi.fn()] as const,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    favourites: { service: accountState.saved, form: [], differential: [] },
    ready: accountState.ready,
    loadError: accountState.loadError,
    error: null,
    isAuthenticated: true,
    isSaved: (_type: string, key: string) => accountState.saved.includes(key),
    setFavourite,
    clearFavourites: vi.fn(async () => true),
    reload: vi.fn(),
  }),
}));

import { ServicesNavigatorPage } from "@/components/services/services-navigator-page";

/**
 * Regression cover for the readiness half of the bookmark control.
 *
 * `AccountDataProvider` initialises `ready` to `auth.status !== "authenticated"`,
 * so for a signed-in reader it is FALSE until the favourites GET resolves, and
 * `favourites` is empty for that whole window. `isSaved()` therefore answers
 * "no" for every service — not because nothing is saved, but because nothing has
 * been read yet. Without a readiness gate the row asserts "Save X to favourites"
 * on a service the reader has already saved, and a tap issues a redundant write
 * inverting a state that was never loaded.
 */
describe("services result bookmark readiness", () => {
  it("does not assert a saved state while the account read is still in flight", () => {
    accountState.ready = false;
    accountState.saved = [registryRecords[0]!.slug];
    render(<ServicesNavigatorPage />);

    const control = screen.getByRole("button", { name: `Loading saved state for ${registryRecords[0]!.title}` });
    expect(control).toBeDisabled();
    // The critical assertion: it must not claim "not saved" for a service that
    // IS saved. No aria-pressed at all beats a confidently wrong one.
    expect(control).not.toHaveAttribute("aria-pressed");
    expect(
      screen.queryByRole("button", { name: `Save ${registryRecords[0]!.title} to favourites` }),
    ).not.toBeInTheDocument();
  });

  it("reports the real saved state once the read settles", () => {
    accountState.ready = true;
    accountState.loadError = null;
    accountState.saved = [registryRecords[0]!.slug];
    render(<ServicesNavigatorPage />);

    const saved = screen.getByRole("button", { name: `Remove ${registryRecords[0]!.title} from favourites` });
    expect(saved).toBeEnabled();
    expect(saved).toHaveAttribute("aria-pressed", "true");

    const unsaved = screen.getByRole("button", { name: `Save ${registryRecords[1]!.title} to favourites` });
    expect(unsaved).toHaveAttribute("aria-pressed", "false");
  });

  it("does not assert or mutate saved state after the account read fails", () => {
    accountState.ready = true;
    accountState.loadError = "Saved items could not be loaded.";
    accountState.saved = [];
    render(<ServicesNavigatorPage />);

    const control = screen.getByRole("button", {
      name: `Saved state unavailable for ${registryRecords[0]!.title}`,
    });
    expect(control).toBeDisabled();
    expect(control).not.toHaveAttribute("aria-pressed");
    fireEvent.click(control);
    expect(setFavourite).not.toHaveBeenCalled();
  });

  it("serializes in-flight mutations across result rows", async () => {
    accountState.ready = true;
    accountState.loadError = null;
    accountState.saved = [];
    let finishSave: ((saved: boolean) => void) | undefined;
    setFavourite.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    render(<ServicesNavigatorPage />);

    const control = screen.getByRole("button", { name: `Save ${registryRecords[0]!.title} to favourites` });
    const siblingControl = screen.getByRole("button", {
      name: `Save ${registryRecords[1]!.title} to favourites`,
    });
    fireEvent.click(control);

    await waitFor(() => expect(control).toBeDisabled());
    expect(siblingControl).toBeDisabled();
    fireEvent.click(control);
    fireEvent.click(siblingControl);
    expect(setFavourite).toHaveBeenCalledTimes(1);

    finishSave?.(true);
    await waitFor(() => expect(control).toBeEnabled());
  });
});
