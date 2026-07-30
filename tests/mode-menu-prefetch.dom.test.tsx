/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
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
  useSavedRegistryFavourites: () => ({
    items: [],
    status: "ready",
    registryStatus: "ready",
    refetch: () => undefined,
  }),
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

function guestModeHomes() {
  return visibleAppModeDefinitionsForSession({ authenticated: false, demoMode: false });
}

describe("mode menu home prefetch", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
    router.prefetch.mockReset();
  });

  it("prefetches a mode home when the user points at that option", async () => {
    const user = userEvent.setup();
    const documents = guestModeHomes().find((mode) => mode.id === "documents");
    expect(documents).toBeTruthy();
    const documentsHref = appModeHomeHref("documents");

    render(<MasterSearchHeader {...headerProps()} />);
    await user.click(screen.getByRole("button", { name: /Mode Answer/i }));
    const menu = await screen.findByRole("menu", { name: "Choose app mode" });

    // Opening on the current mode is a no-op; scanning another option warms it.
    expect(router.prefetch).not.toHaveBeenCalledWith(documentsHref);
    await user.hover(within(menu).getByRole("menuitemradio", { name: /Documents/i }));
    expect(router.prefetch).toHaveBeenCalledWith(documentsHref);
    const prefetched = new Set(router.prefetch.mock.calls.map(([href]) => href as string));
    expect(prefetched.has(documentsHref)).toBe(true);
    expect(prefetched.size).toBeLessThan(guestModeHomes().length);
  });

  it("prefetches the highlighted mode when openModeMenuWithFocus targets another home", async () => {
    const user = userEvent.setup();
    const modes = guestModeHomes();
    const answerIndex = modes.findIndex((mode) => mode.id === "answer");
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    const previous = modes[(answerIndex - 1 + modes.length) % modes.length];
    expect(previous.id).not.toBe("answer");
    const previousHref = appModeHomeHref(previous.id);

    render(<MasterSearchHeader {...headerProps()} />);
    const trigger = screen.getByRole("button", { name: /Mode Answer/i });
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    await screen.findByRole("menu", { name: "Choose app mode" });

    expect(router.prefetch).toHaveBeenCalledWith(previousHref);
    expect(new Set(router.prefetch.mock.calls.map(([href]) => href)).size).toBe(1);
  });
});
