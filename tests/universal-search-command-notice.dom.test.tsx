/** @vitest-environment jsdom */

// #HXC4D4 (a): a query over the search API's 200-character limit, or a failed
// cross-entity request, used to render as a silent empty dropdown. The command
// surface now says which happened, in one short line.

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UniversalSearchCommandSurface } from "@/components/clinical-dashboard/universal-search-command-surface";

const universal = vi.hoisted(() => ({
  state: { groups: [], loading: false, query: "" } as Record<string, unknown>,
}));

vi.mock("@/components/clinical-dashboard/use-universal-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/clinical-dashboard/use-universal-search")>();
  return { ...actual, useUniversalSearch: () => universal.state };
});

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ status: "signed_out", session: null, isConfigured: true, authorizationHeader: {} }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => ({ items: [], status: "ready", registryStatus: "ready", refetch: () => undefined }),
}));

vi.mock("@/components/clinical-dashboard/search-command-context", () => ({
  useSearchCommand: () => null,
}));

function Surface({ query }: { query: string }) {
  return (
    <UniversalSearchCommandSurface
      demoMode={false}
      canAccessFavourites={false}
      modeId="prescribing"
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

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("command surface cross-search notices (#HXC4D4)", () => {
  it("tells the reader a query is too long instead of showing nothing", async () => {
    universal.state = { groups: [], loading: false, query: "", tooLong: true };
    render(<Surface query={"x".repeat(250)} />);

    await screen.findByRole("listbox");
    expect(screen.getByRole("status")).toHaveTextContent(/200 characters/);
  });

  it("tells the reader when matches from other areas could not be loaded", async () => {
    universal.state = {
      groups: [],
      loading: false,
      query: "sertraline",
      error: "Could not load matches from other areas. Edit the search to try again.",
    };
    render(<Surface query="sertraline" />);

    await screen.findByRole("listbox");
    expect(screen.getByRole("status")).toHaveTextContent("Could not load matches from other areas");
  });

  it("shows no notice for an ordinary result", async () => {
    universal.state = { groups: [], loading: false, query: "sertraline" };
    render(<Surface query="sertraline" />);

    await screen.findByRole("listbox");
    expect(screen.queryByText(/200 characters/)).toBeNull();
    expect(screen.queryByText(/Could not load matches/)).toBeNull();
  });
});
