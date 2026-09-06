import { render, screen, within } from "@testing-library/react";
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

  it("does not paint invented fallback captions as visible heading chrome", () => {
    render(<AccessibleTable caption="Document table" columns={columns} rows={rows} hidePreviewCaption />);

    expect(screen.getByRole("table", { name: "Document table" })).toBeInTheDocument();
    expect(screen.getAllByText("Document table")).toHaveLength(1);
    expect(screen.getByText("Document table").tagName.toLowerCase()).toBe("caption");
  });

  it("does not paint invented caption chrome in the expanded dialog when chrome is hidden", async () => {
    setMatchMedia(true);
    const user = userEvent.setup();

    render(
      <AccessibleTable
        caption="Document table"
        dialogTitle="Document table"
        columns={columns}
        rows={rows}
        expandOnMobile
        hidePreviewCaption
      />,
    );

    await user.click(screen.getByTestId("table-expand-button"));
    const dialog = screen.getByTestId("table-fullscreen-dialog");
    expect(dialog).toBeInTheDocument();
    // Sheet title may still name the dialog, but the table surface itself must
    // not grow a second visible "Document table" heading above the grid.
    const visualCaptions = Array.from(dialog.querySelectorAll('[aria-hidden="true"]')).filter(
      (element) => element.textContent === "Document table",
    );
    expect(visualCaptions).toHaveLength(0);
    const dialogTable = within(dialog).getByRole("table", { name: "Document table" });
    expect(dialogTable.querySelector("caption")).toHaveTextContent("Document table");
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

  it("keeps the full missing-value phrase readable in the dense 320px preview", () => {
    render(<AccessibleTable caption="Clozapine monitoring" columns={columns} rows={[["0", ""]]} densePreview />);

    const missingValue = screen.getByTestId("missing-value");
    const valueWrapper = missingValue.parentElement;

    expect(missingValue).toHaveTextContent("Not recorded");
    expect(valueWrapper).not.toBeNull();
    expect(valueWrapper!).toHaveClass("whitespace-normal", "break-words");
    expect(valueWrapper!).not.toHaveClass("truncate");
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

  // Audit H3: a metadata header that is not a bare metadata word ("Source: 3",
  // "Page 2") survives column removal and is then blanked by the cell cleaner.
  // Dropping only the header shifted every later body cell one column left, so a
  // clinician read a dose under the wrong heading and the last value vanished.
  it("drops a metadata column that cleans to empty without shifting clinical body cells", () => {
    render(
      <AccessibleTable
        caption="Maximum daily dose"
        clinicalOnly
        columns={["Drug", "Source: 3", "Max dose"]}
        rows={[
          ["Lithium", "RANZCP", "1200 mg"],
          ["Sodium valproate", "RANZCP", "2000 mg"],
        ]}
      />,
    );

    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent?.trim())).toEqual(["Drug", "Max dose"]);

    const bodyRows = screen.getAllByRole("row").slice(1);
    const firstRowCells = within(bodyRows[0]).getAllByRole("cell");
    expect(firstRowCells).toHaveLength(2);
    expect(firstRowCells[0]).toHaveTextContent("Lithium");
    expect(firstRowCells[1]).toHaveTextContent("1200 mg");

    const secondRowCells = within(bodyRows[1]).getAllByRole("cell");
    expect(secondRowCells[1]).toHaveTextContent("2000 mg");

    // The dropped column's body values must not reappear under a clinical heading.
    expect(screen.queryByText("RANZCP")).not.toBeInTheDocument();
  });

  // Audit L19: the in-cell scrub removed "p. 14" but left its brackets behind,
  // so a clinician read "(...)"-shaped debris in a clinical cell.
  it("removes an in-cell page pointer together with its brackets", () => {
    render(
      <AccessibleTable
        caption="Lithium monitoring"
        clinicalOnly
        columns={["Parameter", "Target"]}
        rows={[
          ["Serum lithium level", "0.6 mmol/L (p. 14)"],
          ["Renal function", "Six-monthly [source 3]"],
        ]}
      />,
    );

    const bodyRows = screen.getAllByRole("row").slice(1);
    const firstRowCells = within(bodyRows[0]).getAllByRole("cell");
    expect(firstRowCells[1]).toHaveTextContent("0.6 mmol/L");
    expect(firstRowCells[1].textContent).not.toContain("(");
    expect(firstRowCells[1].textContent).not.toContain(")");

    const secondRowCells = within(bodyRows[1]).getAllByRole("cell");
    expect(secondRowCells[1]).toHaveTextContent("Six-monthly");
    expect(secondRowCells[1].textContent).not.toContain("[");
    expect(secondRowCells[1].textContent).not.toContain("]");
  });

  // COMPONENTS §0.4 AccessibleTable row — ledger #263.
  it("keeps the full header string reachable when the dense preview ellipsises it", () => {
    render(
      <AccessibleTable
        caption="Clozapine monitoring"
        columns={["Recommended starting dose for the first 14 days", "Management"]}
        rows={[["12.5 mg nocte", "Monitor observations"]]}
        densePreview
      />,
    );

    // A clipped header is the only thing that says what its column of numbers
    // means, so the untruncated string has to survive somewhere.
    const header = screen.getByRole("columnheader", { name: "Recommended starting dose for the first 14 days" });
    expect(header.className).toContain("text-ellipsis");
    expect(header).toHaveAttribute("title", "Recommended starting dose for the first 14 days");
  });

  it("does not add a title to headers that wrap rather than clip", () => {
    render(<AccessibleTable caption="Clozapine monitoring" columns={columns} rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "Management" })).not.toHaveAttribute("title");
  });

  it("builds the expand control from the registered Button rather than a local recipe", () => {
    setMatchMedia(true);
    render(
      <AccessibleTable
        caption="Clozapine monitoring"
        dialogTitle="Clozapine monitoring"
        columns={columns}
        rows={rows}
        expandOnMobile
      />,
    );

    const expander = screen.getByTestId("table-expand-button");
    // The hand-rolled class string had drifted off the system: a ring focus
    // treatment no other control uses, and a raw h-4/w-4 glyph off the icon scale.
    expect(expander.className).toContain("focus-visible:outline");
    expect(expander.className).not.toContain("focus-visible:ring");
    expect(expander.querySelector(".h-4.w-4")).toBeNull();
    expect(expander.querySelector(".size-icon-md")).not.toBeNull();
    expect(expander).toHaveAccessibleName("Open Clozapine monitoring full screen");
  });
});
