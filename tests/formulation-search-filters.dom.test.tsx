/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormulationHomePage } from "@/components/formulation/formulation-home-page";
import { searchFormulationMechanisms } from "@/lib/formulation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("FormulationHomePage filters", () => {
  it("keeps one OR facet while round-tripping domain state in the URL", async () => {
    const user = userEvent.setup();
    const query = "coping";
    const domain = searchFormulationMechanisms(query)[0]?.mechanism.domains[0];
    expect(domain).toBeTruthy();
    window.history.replaceState(null, "", "/formulation?q=coping&focus=1");

    const view = render(<FormulationHomePage query={query} autoRunSearch />);
    await user.click(screen.getByTestId("formulation-filter-trigger-phone"));
    const panel = screen.getByTestId("formulation-filter-panel");
    expect(within(panel).getAllByRole("group", { name: "Domain" })).toHaveLength(1);
    expect(within(panel).getByText(/Domains combine with OR/)).toBeVisible();
    await user.click(within(panel).getByRole("button", { name: new RegExp(`^${domain} \\(`) }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get("domain")).toBe(domain);
    expect(params.get("q")).toBe("coping");
    expect(params.get("focus")).toBe("1");
    view.rerender(<FormulationHomePage query={query} autoRunSearch />);
    expect(screen.getByRole("button", { name: `Remove Domain: ${domain} filter` })).toBeVisible();
  });
});
