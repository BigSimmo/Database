import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AccessibleTable } from "@/components/AccessibleTable";
import { installMatchMediaStub as setMatchMedia } from "./setup/jsdom.setup";

// Interactive counterpart to tests/accessible-table-fallback.test.ts (which asserts
// on the SSR-rendered HTML string). This exercises the same component under jsdom
// via @testing-library/react so real DOM state + user interaction are covered: the
// mobile "Expand table" affordance and the full-screen dialog it toggles.

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

  it("uses one semantic caption as the table name while keeping visual caption chrome silent", () => {
    render(<AccessibleTable caption="Clozapine monitoring" columns={columns} rows={rows} />);

    const table = screen.getByRole("table", { name: "Clozapine monitoring" });
    expect(table).not.toHaveAttribute("aria-label");
    expect(table.querySelectorAll("caption")).toHaveLength(1);
    expect(table.querySelector("caption")).toHaveTextContent("Clozapine monitoring");

    const visualCaption = screen
      .getAllByText("Clozapine monitoring")
      .find((element) => element.tagName.toLowerCase() === "div");
    expect(visualCaption).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the semantic caption when preview caption chrome is hidden", () => {
    render(<AccessibleTable caption="Clozapine monitoring" columns={columns} rows={rows} hidePreviewCaption />);

    const table = screen.getByRole("table", { name: "Clozapine monitoring" });
    expect(table.querySelector("caption")).toHaveTextContent("Clozapine monitoring");
    expect(screen.getAllByText("Clozapine monitoring")).toHaveLength(1);
  });

  it("renders explicit missing values and action text instead of ambiguous dashes", () => {
    render(
      <AccessibleTable
        caption="Clozapine monitoring"
        columns={columns}
        rows={[
          ["0", ""],
          ["1", "Review observations"],
        ]}
        rowActions={[
          null,
          <button key="review" type="button" onClick={() => {}}>
            Review
          </button>,
        ]}
      />,
    );

    expect(screen.getAllByTestId("missing-value")).toHaveLength(1);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Not recorded");
    expect(screen.getByText("No action available")).toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
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

  it("shows the provided source-image fallback for low-confidence clinical tables", () => {
    render(
      <AccessibleTable
        caption="Dose table"
        columns={["Medication", "", "Action"]}
        rows={[["Lorazepam", "1 mg", "Monitor observations"]]}
        lowConfidenceFallback={<div data-testid="source-table-image">Original table image</div>}
      />,
    );

    expect(screen.getByTestId("table-low-confidence-note")).toHaveTextContent("showing the source document image");
    expect(screen.getByTestId("source-table-image")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
