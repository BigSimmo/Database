import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AccessibleTable } from "@/components/AccessibleTable";
import { installMatchMediaStub as setMatchMedia } from "./setup/jsdom.setup";

// Register #48: dose columns were left-aligned as text, so `tabular-nums` had
// nothing to stack against. Numeric columns must right-align; prose columns must
// not. Register #8: the expander advertised `aria-expanded` with no
// `aria-controls`, so assistive technology could not tell what expanded.

const doseColumns = ["Drug", "Starting dose", "Maximum dose"];
const doseRows = [
  ["Lithium", "250 mg", "1200 mg"],
  ["Sodium valproate", "500 mg", "2000 mg"],
  ["Quetiapine", "25 mg", "800 mg"],
];

function headerCell(name: string) {
  return screen.getAllByRole("columnheader").find((cell) => cell.textContent?.trim() === name);
}

describe("AccessibleTable numeric column alignment", () => {
  it("right-aligns columns whose every cell is numeric and leaves prose columns alone", () => {
    render(<AccessibleTable caption="Dose ranges" columns={doseColumns} rows={doseRows} />);

    expect(headerCell("Starting dose")?.className).toContain("text-right");
    expect(headerCell("Maximum dose")?.className).toContain("text-right");
    expect(headerCell("Drug")?.className).not.toContain("text-right");

    const table = screen.getByRole("table");
    const dataRows = within(table).getAllByRole("row").slice(1);
    const firstRowCells = within(dataRows[0]).getAllByRole("cell");
    // Stacked phone cards keep values left-aligned under their own label, so the
    // alignment is applied at the `md` breakpoint rather than unconditionally.
    expect(firstRowCells[0].className).not.toContain("text-right");
    expect(firstRowCells[1].className).toContain("md:text-right");
  });

  it("does not right-align a column that mixes numbers with prose", () => {
    render(
      <AccessibleTable
        caption="Mixed"
        columns={["Score", "Note"]}
        rows={[
          ["0", "12 hourly observations"],
          ["1", "Escalate to the registrar"],
        ]}
      />,
    );

    expect(headerCell("Score")?.className).toContain("text-right");
    expect(headerCell("Note")?.className).not.toContain("text-right");
  });

  it("honours an explicit columnAlign override in both directions", () => {
    render(
      <AccessibleTable
        caption="Dose ranges"
        columns={doseColumns}
        rows={doseRows}
        columnAlign={["end", "start", "auto"]}
      />,
    );

    expect(headerCell("Drug")?.className).toContain("text-right");
    expect(headerCell("Starting dose")?.className).not.toContain("text-right");
    expect(headerCell("Maximum dose")?.className).toContain("text-right");
  });

  it("honours numericColumns as the outright answer, skipping detection", () => {
    render(<AccessibleTable caption="Dose ranges" columns={doseColumns} rows={doseRows} numericColumns={[0]} />);

    expect(headerCell("Drug")?.className).toContain("text-right");
    expect(headerCell("Starting dose")?.className).not.toContain("text-right");
  });
});

describe("AccessibleTable expander wiring", () => {
  it("points aria-controls at the dialog it opens", async () => {
    setMatchMedia(true);
    const user = userEvent.setup();
    render(<AccessibleTable caption="Dose ranges" columns={doseColumns} rows={doseRows} expandOnMobile />);

    const expander = screen.getByTestId("table-expand-button");
    // Closed: nothing to control yet, so the attribute must be absent rather than
    // pointing at an id that resolves to no element.
    expect(expander).toHaveAttribute("aria-expanded", "false");
    expect(expander).not.toHaveAttribute("aria-controls");

    await user.click(expander);

    const dialog = screen.getByTestId("table-fullscreen-dialog");
    expect(expander).toHaveAttribute("aria-expanded", "true");
    expect(expander.getAttribute("aria-controls")).toBe(dialog.id);
    expect(dialog.id).toBeTruthy();
  });
});
