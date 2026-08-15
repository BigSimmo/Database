/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { appModeSelectionHref, visibleAppModeDefinitionsForSession, type AppModeId } from "@/lib/app-modes";

/**
 * The shared-home URL the mode picker itself will open for `modeId`.
 */
function modeSelectionHref(modeId: AppModeId) {
  return appModeSelectionHref(modeId);
}

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

describe("mode menu destination prefetch", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
    router.prefetch.mockReset();
  });

  it("keeps calculator submission enabled when document data is unavailable", async () => {
    const user = userEvent.setup();
    const onAsk = vi.fn();

    render(
      <MasterSearchHeader
        {...headerProps()}
        searchMode="calculators"
        query="PHQ-9"
        realDataReady={false}
        onAsk={onAsk}
      />,
    );

    const submit = screen.getByRole("button", { name: "Search clinical calculators" });
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it("shows calculator-specific actions instead of Answer actions", async () => {
    const user = userEvent.setup();

    render(<MasterSearchHeader {...headerProps()} searchMode="calculators" />);
    await user.click(screen.getByRole("button", { name: "Open calculators options" }));

    const actions = await screen.findByRole("menu", { name: "Useful actions" });
    expect(within(actions).getByRole("menuitem", { name: "Browse calculators" })).toBeVisible();
    expect(within(actions).queryByRole("menuitem", { name: "New question" })).toBeNull();
    expect(within(actions).queryByRole("menuitem", { name: "Add document" })).toBeNull();
  });

  it("prefetches the shared-home selection URL when the user points at a mode", async () => {
    const user = userEvent.setup();
    const documents = guestModeHomes().find((mode) => mode.id === "documents");
    expect(documents).toBeTruthy();
    const documentsHref = modeSelectionHref("documents");

    render(<MasterSearchHeader {...headerProps()} />);
    await user.click(screen.getByRole("button", { name: /Mode Answer/i }));
    const menu = await screen.findByRole("menu", { name: "Choose app mode" });

    // Opening on the current mode is a no-op; scanning another option warms it.
    expect(router.prefetch.mock.calls.some(([href]) => href === documentsHref)).toBe(false);
    await user.hover(within(menu).getByRole("menuitemradio", { name: /Documents/i }));
    expect(router.prefetch.mock.calls.some(([href]) => href === documentsHref)).toBe(true);
    const prefetched = new Set(router.prefetch.mock.calls.map(([href]) => href as string));
    expect(prefetched.has(documentsHref)).toBe(true);
    expect(prefetched.size).toBeLessThan(guestModeHomes().length);
  });

  it("warms a mode again after Next invalidates its cached payload", async () => {
    const user = userEvent.setup();
    const documentsHref = modeSelectionHref("documents");

    render(<MasterSearchHeader {...headerProps()} />);
    await user.click(screen.getByRole("button", { name: /Mode Answer/i }));
    const documentsOption = within(await screen.findByRole("menu", { name: "Choose app mode" })).getByRole(
      "menuitemradio",
      { name: /Documents/i },
    );
    await user.hover(documentsOption);

    const [, options] = router.prefetch.mock.calls.find(([href]) => href === documentsHref) ?? [];
    expect(options?.onInvalidate).toBeTypeOf("function");
    options.onInvalidate();
    await user.unhover(documentsOption);
    await user.hover(documentsOption);

    expect(router.prefetch.mock.calls.filter(([href]) => href === documentsHref)).toHaveLength(2);
  });

  it("prefetches the highlighted mode when openModeMenuWithFocus targets another mode", async () => {
    const user = userEvent.setup();
    const modes = guestModeHomes();
    const answerIndex = modes.findIndex((mode) => mode.id === "answer");
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    const previous = modes[(answerIndex - 1 + modes.length) % modes.length];
    expect(previous.id).not.toBe("answer");
    const previousHref = modeSelectionHref(previous.id);

    render(<MasterSearchHeader {...headerProps()} />);
    const trigger = screen.getByRole("button", { name: /Mode Answer/i });
    trigger.focus();
    await user.keyboard("{ArrowUp}");
    await screen.findByRole("menu", { name: "Choose app mode" });

    expect(router.prefetch.mock.calls.some(([href]) => href === previousHref)).toBe(true);
    expect(new Set(router.prefetch.mock.calls.map(([href]) => href)).size).toBe(1);
  });

  it("restores mode-trigger focus when re-selecting the already active mode", async () => {
    const user = userEvent.setup();
    const onSearchModeChange = vi.fn();
    render(<MasterSearchHeader {...headerProps()} onSearchModeChange={onSearchModeChange} />);

    const trigger = screen.getByRole("button", { name: /Mode Answer/i });
    await user.click(trigger);
    const answerOption = within(await screen.findByRole("menu", { name: "Choose app mode" })).getByRole(
      "menuitemradio",
      { name: /Answer/i },
    );
    await user.click(answerOption);

    expect(onSearchModeChange).toHaveBeenCalledWith("answer");
    await vi.waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("does not steal focus when the user moves elsewhere during same-mode restore", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MasterSearchHeader {...headerProps()} />
        <button type="button">Outside control</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: /Mode Answer/i });
    await user.click(trigger);
    const answerOption = within(await screen.findByRole("menu", { name: "Choose app mode" })).getByRole(
      "menuitemradio",
      { name: /Answer/i },
    );
    await user.click(answerOption);

    const outside = screen.getByRole("button", { name: "Outside control" });
    outside.focus();
    await vi.waitFor(() => {
      expect(outside).toHaveFocus();
    });
    // Deferred same-mode restore must honor restoreFocusUnlessMoved and leave
    // deliberately moved focus alone.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(outside).toHaveFocus();
    expect(trigger).not.toHaveFocus();
  });
});
