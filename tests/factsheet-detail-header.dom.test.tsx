import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FactsheetDetailPage } from "@/components/factsheets/factsheet-detail-page";
import { findFactsheet } from "@/components/factsheets/factsheets-data";

function renderFactsheet(slug: string) {
  const factsheet = findFactsheet(slug);
  if (!factsheet) throw new Error(`Expected the ${slug} factsheet fixture`);
  return { factsheet, ...render(<FactsheetDetailPage factsheet={factsheet} />) };
}

describe("factsheet detail header", () => {
  it("keeps the record title as the on-screen page's only h1", () => {
    // The header title is a `<span>`; the hero owns the heading. Two `<h1>`s
    // with the same text is the failure this guards. Scoped to the shell: the
    // print sheet is portaled to <body> and carries its own `<h1>`, but it is
    // `display: none` on screen and predates this header.
    const { factsheet } = renderFactsheet("sertraline");
    const page = screen.getByTestId("factsheet-detail-page");
    const headings = within(page).getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(factsheet.title);
  });

  it("names the way back without spending the row on its label", () => {
    renderFactsheet("sertraline");
    const back = screen.getByRole("link", { name: "Back to all factsheets" });
    expect(back).toHaveAttribute("href", "/factsheets/search");
    expect(within(back).queryByText("All factsheets")).toBeNull();
  });

  it("switches the body copy between reading levels", async () => {
    // Reading level drives `FactsheetBody` and the print sheet, not just the
    // control, so the page keeps ownership of the state.
    const user = userEvent.setup();
    const { factsheet } = renderFactsheet("sertraline");
    if (factsheet.kind !== "medRich") throw new Error("Expected sertraline to be the medRich fixture");

    const group = screen.getByRole("radiogroup", { name: "Reading level" });
    expect(screen.getAllByText(factsheet.whatEasy).length).toBeGreaterThan(0);

    await user.click(within(group).getByRole("radio", { name: "Standard" }));

    expect(screen.getAllByText(factsheet.whatStandard).length).toBeGreaterThan(0);
    expect(screen.queryByText(factsheet.whatEasy)).toBeNull();
  });

  it("reserves no reading-level control on a factsheet that has one level", () => {
    // Seven of the eight sheets are not `medRich`; none of them should carry
    // the band or an empty gap where it would be.
    const { factsheet } = renderFactsheet("depression");
    expect(factsheet.kind).not.toBe("medRich");
    expect(screen.queryByRole("radiogroup", { name: "Reading level" })).toBeNull();
  });

  it("offers the download without opening anything", () => {
    // The promoted action is the reason the header is worth pinning; it must
    // not be behind the ellipsis.
    renderFactsheet("sertraline");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });
});
