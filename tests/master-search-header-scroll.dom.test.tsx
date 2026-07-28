import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({ status: "signed_out", session: null, isConfigured: false, error: null }),
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
    searchMode: "documents" as const,
    loading: false,
    selectedDocumentIds: [] as string[],
    queryMode: "auto" as const,
    scopeFilters: {},
    realDataReady: true,
    onQueryChange: vi.fn(),
    onSearchModeChange: vi.fn(),
    onAsk: vi.fn(),
    onClearQuery: vi.fn(),
    onClearScope: vi.fn(),
    onQueryModeChange: vi.fn(),
    onScopeFiltersChange: vi.fn(),
    onToggleScope: vi.fn(),
    queryModeOptions: [{ value: "auto" as const, label: "Auto" }],
  };
}

describe("MasterSearchHeader all-breakpoint collapse", () => {
  it("collapses the full chrome and reports its effective hidden state", async () => {
    const onHeaderChromeHiddenChange = vi.fn();
    render(
      <MasterSearchHeader
        {...headerProps()}
        hideOnScroll={{ strategy: "collapse", allBreakpoints: true, scrollHidden: true }}
        onHeaderChromeHiddenChange={onHeaderChromeHiddenChange}
      />,
    );

    const collapse = screen.getByTestId("universal-header-collapse");
    expect(collapse).toHaveAttribute("data-scroll-hidden", "true");
    expect(collapse.className).toContain("[grid-template-rows:0fr]");
    await waitFor(() => expect(onHeaderChromeHiddenChange).toHaveBeenLastCalledWith(true));
  });

  it("reveals while a header control is focused or its mode menu is open", async () => {
    const user = userEvent.setup();
    render(
      <MasterSearchHeader
        {...headerProps()}
        hideOnScroll={{ strategy: "collapse", allBreakpoints: true, scrollHidden: true }}
      />,
    );

    const collapse = screen.getByTestId("universal-header-collapse");
    const modeButton = screen.getByRole("button", { name: /Mode Documents/i });
    expect(collapse).toHaveAttribute("data-scroll-hidden", "true");

    fireEvent.focus(modeButton);
    expect(collapse).not.toHaveAttribute("data-scroll-hidden");
    fireEvent.blur(modeButton, { relatedTarget: null });
    expect(collapse).toHaveAttribute("data-scroll-hidden", "true");

    await user.click(modeButton);
    expect(await screen.findByRole("menu", { name: "Choose app mode" })).toBeVisible();
    expect(collapse).not.toHaveAttribute("data-scroll-hidden");
  });

  it("stays visible while the host-owned mobile menu is open", () => {
    const { rerender } = render(
      <MasterSearchHeader
        {...headerProps()}
        hideOnScroll={{ strategy: "collapse", allBreakpoints: true, scrollHidden: true }}
      />,
    );

    const collapse = screen.getByTestId("universal-header-collapse");
    expect(collapse).toHaveAttribute("data-scroll-hidden", "true");

    rerender(
      <MasterSearchHeader
        {...headerProps()}
        hideOnScroll={{ strategy: "collapse", allBreakpoints: true, scrollHidden: true }}
        externalMenuOpen
      />,
    );
    expect(collapse).not.toHaveAttribute("data-scroll-hidden");
  });
});
