/** @vitest-environment jsdom */

// #358YM0: demo mode shows fixture favourites ("last opened Today 08:44", preset
// sets) that are not the clinician's own. Every surface that shows them labels
// them "Example": the /favourites library (pinned in favourites-auth-gate), the
// dashboard Favourites hub, and the command-surface dropdown. A clinician's own
// saved favourites are never labelled.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";
import { favouriteItems, type FavouriteItem } from "@/components/clinical-dashboard/favourites-prototype-data";
import { UniversalSearchCommandSurface } from "@/components/clinical-dashboard/universal-search-command-surface";

const savedRegistry = vi.hoisted(() => ({ items: [] as FavouriteItem[] }));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => ({
    items: savedRegistry.items,
    status: "ready",
    registryStatus: "ready",
    refetch: () => undefined,
  }),
}));

vi.mock("@/components/clinical-dashboard/use-universal-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/clinical-dashboard/use-universal-search")>();
  return { ...actual, useUniversalSearch: () => ({ groups: [], loading: false, query: "" }) };
});

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ status: "signed_out", session: null, isConfigured: true, authorizationHeader: {} }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/components/clinical-dashboard/search-command-context", () => ({
  useSearchCommand: () => null,
}));

const fixture = favouriteItems[0];
const ownSaved: FavouriteItem = { ...fixture, id: "saved-own", title: "My own acamprosate note", href: "/own" };

function Surface({ demoMode, query }: { demoMode: boolean; query: string }) {
  return (
    <UniversalSearchCommandSurface
      demoMode={demoMode}
      canAccessFavourites
      modeId="favourites"
      query={query}
      recentQueries={[]}
      dropdownOpen
      onDropdownOpenChange={() => undefined}
      onQueryChange={() => undefined}
      onSearch={() => undefined}
      onPickRecent={() => undefined}
      onCrossMode={() => undefined}
    >
      <input data-testid="global-search-input" />
    </UniversalSearchCommandSurface>
  );
}

function optionFor(title: string) {
  const option = screen.getAllByRole("option").find((node) => node.textContent?.includes(title));
  if (!option) throw new Error(`no option for ${title}`);
  return option;
}

beforeEach(() => {
  savedRegistry.items = [];
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("demo favourites are labelled Example (#358YM0)", () => {
  it("labels every fixture item on the dashboard Favourites hub", () => {
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode />);

    expect(screen.getByText("Example favourites shown in demo mode")).toBeInTheDocument();
    const row = screen.getByText(fixture.title).closest("article");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Example", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText("Example", { exact: true }).length).toBeGreaterThanOrEqual(favouriteItems.length);
  });

  it("never labels the clinician's own favourites on the hub", () => {
    savedRegistry.items = [ownSaved];
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode={false} />);

    expect(screen.getByText(ownSaved.title)).toBeInTheDocument();
    expect(screen.queryByText("Example", { exact: true })).toBeNull();
    expect(screen.queryByText("Example favourites shown in demo mode")).toBeNull();
  });

  it("labels a demo fixture in the command dropdown as an example, not as saved", async () => {
    render(<Surface demoMode query="acamprosate" />);

    await screen.findByRole("listbox");
    const option = optionFor(fixture.title);
    expect(within(option).getByText("Example", { exact: true })).toBeInTheDocument();
    expect(within(option).queryByText("Saved", { exact: true })).toBeNull();
  });

  it("keeps the Saved label for the clinician's own favourite in the command dropdown", async () => {
    savedRegistry.items = [ownSaved];
    render(<Surface demoMode={false} query="acamprosate" />);

    await screen.findByRole("listbox");
    const option = optionFor(ownSaved.title);
    expect(within(option).getByText("Saved", { exact: true })).toBeInTheDocument();
    expect(within(option).queryByText("Example", { exact: true })).toBeNull();
  });

  it("prefers the clinician's own favourite over a fixture sharing its link in the dropdown", async () => {
    // Same href and title as the fixture, so both score identically; fixtures come first.
    savedRegistry.items = [{ ...fixture, id: "saved-twin" }];
    render(<Surface demoMode query="acamprosate" />);

    await screen.findByRole("listbox");
    const option = optionFor(fixture.title);
    expect(within(option).getByText("Saved", { exact: true })).toBeInTheDocument();
    expect(within(option).queryByText("Example", { exact: true })).toBeNull();
  });

  it("never files the clinician's own favourite under a set labelled Example on the hub", () => {
    savedRegistry.items = [{ ...ownSaved, set: fixture.set }];
    render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode />);

    const setRows = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.startsWith(fixture.set) || button.textContent?.includes(fixture.set));
    expect(setRows.length).toBeGreaterThan(0);
    for (const row of setRows) expect(within(row).queryByText("Example", { exact: true })).toBeNull();
  });

  // A truncating flex child needs min-w-0, or it refuses to shrink and the title
  // pushes the Example tag (and the row) wider instead of ellipsing.
  function expectTruncatingTitlesShrink(root: HTMLElement) {
    const tags = within(root).getAllByText("Example", { exact: true });
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      const truncating = Array.from(tag.parentElement?.children ?? []).filter((node) =>
        (node.getAttribute("class") ?? "").split(/\s+/).includes("truncate"),
      );
      expect(truncating.length).toBeGreaterThan(0);
      for (const node of truncating) expect((node.getAttribute("class") ?? "").split(/\s+/)).toContain("min-w-0");
    }
  }

  it("lets hub item and set titles truncate beside the Example tag", () => {
    const { container } = render(<FavouritesHub query="" onClearQuery={() => undefined} demoMode />);
    expectTruncatingTitlesShrink(container);
  });
});
