import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessibleTable } from "@/components/AccessibleTable";

// Interactive counterpart to tests/accessible-table-fallback.test.ts (which asserts
// on the SSR-rendered HTML string). This exercises the same component under jsdom
// via @testing-library/react so real DOM state + user interaction are covered: the
// mobile "Expand table" affordance and the full-screen dialog it toggles.

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const columns = ["Score", "Management"];
const rows = [["0", "Monitor observations"]];

describe("AccessibleTable (jsdom)", () => {
  it("renders the reconstructed grid and its cells into the DOM", () => {
    render(<AccessibleTable caption="Clozapine monitoring" columns={columns} rows={rows} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    // The responsive markup renders each header/cell more than once (stacked +
    // tabular views), so assert presence via getAllByText rather than a unique match.
    expect(screen.getAllByText("Management").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monitor observations").length).toBeGreaterThan(0);
    // No mobile-expand affordance on the desktop breakpoint (matchMedia → false).
    expect(screen.queryByTestId("table-expand-button")).not.toBeInTheDocument();
  });

  it("opens the full-screen dialog when the mobile expand control is clicked", async () => {
    setMatchMedia(true); // emulate the mobile/coarse-pointer breakpoint that enables expansion
    const user = userEvent.setup();

    render(
      <AccessibleTable
        caption="Clozapine monitoring"
        dialogTitle="Clozapine monitoring"
        columns={columns}
        rows={rows}
        expandOnMobile
      />,
    );

    const expandButton = screen.getByTestId("table-expand-button");
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("table-fullscreen-dialog")).not.toBeInTheDocument();

    await user.click(expandButton);

    expect(expandButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("table-fullscreen-dialog")).toBeInTheDocument();
  });
});
