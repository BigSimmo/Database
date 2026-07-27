/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { appModeHomeHref, visibleAppModeDefinitionsForSession } from "@/lib/app-modes";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    status: "signed_out",
    session: null,
    isConfigured: true,
    error: null,
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/clinical-dashboard/use-saved-registry-favourites", () => ({
  useSavedRegistryFavourites: () => [],
}));

vi.mock("@/components/clinical-dashboard/search-command-context", () => ({
  useSearchCommand: () => null,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

function headerProps() {
  return {
    demoMode: false,
    documents: [],
    query: "",
    searchMode: "answer" as const,
    loading: false,
    selectedDocumentIds: [] as string[],
    queryMode: "auto" as const,
    scopeFilters: {},
    realDataReady: true,
    canAccessFavourites: false,
    onQueryChange: () => undefined,
    onSearchModeChange: vi.fn(),
    onAsk: () => undefined,
    onClearQuery: () => undefined,
    onClearScope: () => undefined,
    onQueryModeChange: () => undefined,
    onScopeFiltersChange: () => undefined,
    onToggleScope: () => undefined,
    queryModeOptions: [{ value: "auto" as const, label: "Auto" }],
  };
}

function expectedModeHomeHrefs() {
  return [
    ...new Set(
      visibleAppModeDefinitionsForSession({ authenticated: false, demoMode: false }).map((mode) =>
        appModeHomeHref(mode.id),
      ),
    ),
  ];
}

function prefetchedHrefs() {
  return router.prefetch.mock.calls.map(([href]) => href as string);
}

describe("mode menu home prefetch", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
    router.prefetch.mockReset();
  });

  it("prefetches distinct mode homes when toggleModeMenu opens the menu", async () => {
    const user = userEvent.setup();
    const expected = expectedModeHomeHrefs();
    expect(expected.length).toBeGreaterThan(1);

    render(<MasterSearchHeader {...headerProps()} />);

    await user.click(screen.getByRole("button", { name: /Mode Answer/i }));
    await screen.findByRole("menu", { name: "Choose app mode" });

    expect(prefetchedHrefs().sort()).toEqual([...expected].sort());
    expect(new Set(prefetchedHrefs()).size).toBe(expected.length);
  });

  it("prefetches distinct mode homes when openModeMenuWithFocus opens via ArrowDown", async () => {
    const user = userEvent.setup();
    const expected = expectedModeHomeHrefs();
    expect(expected.length).toBeGreaterThan(1);

    render(<MasterSearchHeader {...headerProps()} />);

    const trigger = screen.getByRole("button", { name: /Mode Answer/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu", { name: "Choose app mode" });

    expect(prefetchedHrefs().sort()).toEqual([...expected].sort());
    expect(new Set(prefetchedHrefs()).size).toBe(expected.length);
  });
});
