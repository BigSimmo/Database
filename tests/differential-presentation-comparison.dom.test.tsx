import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import { getDifferentialRecord, getPresentationWorkflow } from "@/lib/differentials";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/mode-nav/registry-mode-nav", () => ({ RegistryModeNav: () => null }));
vi.mock("@/components/clinical-dashboard/phone-footer-layer-portal", () => ({
  PhoneFooterLayerPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * #0FT00E. On acute confusion the banner said "4 of 7 diagnoses compared" while
 * all seven columns rendered identically, and the table's fixed 84rem minimum
 * pushed the two unselected EMERGENCY columns (Wernicke encephalopathy, hepatic
 * encephalopathy) off-screen with no cue — on the presentation where Wernicke
 * is the classic miss. The sticky criteria column was also translucent, so
 * scrolled cells bled through the red-flag row labels.
 */
const slug = "acute-confusion-encephalopathy";
const workflow = getPresentationWorkflow(slug)!;
const selectedSlugs = workflow.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.slug);
const unselectedSlugs = workflow.candidates
  .filter((candidate) => !candidate.selected)
  .map((candidate) => candidate.slug);
const titleOf = (candidateSlug: string) => getDifferentialRecord(candidateSlug)!.title;
const unselectedEmergencies = unselectedSlugs.filter(
  (candidateSlug) => getDifferentialRecord(candidateSlug)!.status === "emergent",
);

function comparisonTable() {
  return screen.getByRole("table", { name: "Differential comparison" });
}

function candidateColumnHeaders() {
  // The first column header is the criteria column.
  return within(comparisonTable()).getAllByRole("columnheader").slice(1);
}

describe("presentation comparison table (#0FT00E)", () => {
  it("is exercised on the presentation the audit measured", () => {
    expect(selectedSlugs.length).toBeGreaterThan(0);
    expect(unselectedSlugs.length).toBeGreaterThan(0);
    expect(unselectedEmergencies).toEqual(
      expect.arrayContaining(["wernicke-encephalopathy", "hepatic-encephalopathy"]),
    );
  });

  it("puts the selected diagnoses first and marks every other column Not selected", () => {
    render(<DifferentialPresentationWorkflowPage presentationSlug={slug} />);
    const headers = candidateColumnHeaders();
    expect(headers).toHaveLength(workflow.candidates.length);
    const expectedOrder = [...selectedSlugs, ...unselectedSlugs].map(titleOf);
    headers.forEach((header, index) => {
      expect(header).toHaveTextContent(expectedOrder[index]!);
    });
    headers.slice(0, selectedSlugs.length).forEach((header) => expect(header).not.toHaveTextContent("Not selected"));
    headers.slice(selectedSlugs.length).forEach((header) => expect(header).toHaveTextContent("Not selected"));
  });

  it("follows the selection in the URL, not the catalogue default", () => {
    render(<DifferentialPresentationWorkflowPage presentationSlug={slug} selectedIds={["wernicke-encephalopathy"]} />);
    const headers = candidateColumnHeaders();
    expect(headers[0]).toHaveTextContent(titleOf("wernicke-encephalopathy"));
    expect(headers[0]).not.toHaveTextContent("Not selected");
    headers.slice(1).forEach((header) => expect(header).toHaveTextContent("Not selected"));
  });

  it("sizes the table from its column count with a literal class, never w-max or an inline style", () => {
    render(<DifferentialPresentationWorkflowPage presentationSlug={slug} />);
    const table = comparisonTable();
    expect(table).not.toHaveAttribute("style");
    expect(table.className).not.toMatch(/\bw-max\b/);
    expect(table.className).not.toContain("min-w-[84rem]");
    // 10.75rem criteria column + 8.5rem per candidate column.
    expect(table.className).toContain(`min-w-[${10.75 + 8.5 * workflow.candidates.length}rem]`);
  });

  it("paints every criteria row with an opaque tone so scrolled cells cannot bleed through", () => {
    render(<DifferentialPresentationWorkflowPage presentationSlug={slug} />);
    const rows = within(comparisonTable()).getAllByRole("row").slice(1);
    for (const row of rows) {
      // An alpha suffix such as `/75` on a background makes the sticky row header translucent.
      expect(row.className).not.toMatch(/bg-\[[^\]]+\]\/\d+/);
    }
  });
});

describe("Highest urgency callout (#0FT00E)", () => {
  it("names the unselected emergency diagnoses so they are never only in an off-screen column", () => {
    render(<DifferentialPresentationWorkflowPage presentationSlug={slug} />);
    const headings = screen.getAllByRole("heading", { name: "Highest urgency" });
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      const panel = within(heading.closest("section")!);
      for (const candidateSlug of unselectedEmergencies) {
        expect(panel.getByRole("link", { name: `Open diagnosis: ${titleOf(candidateSlug)}` })).toBeInTheDocument();
      }
      expect(panel.getByText("Not selected")).toBeInTheDocument();
    }
  });

  it("does not list an unselected diagnosis that is not an emergency", () => {
    render(<DifferentialPresentationWorkflowPage presentationSlug={slug} />);
    const nonEmergentUnselected = unselectedSlugs.filter(
      (candidateSlug) => getDifferentialRecord(candidateSlug)!.status !== "emergent",
    );
    for (const heading of screen.getAllByRole("heading", { name: "Highest urgency" })) {
      const panel = within(heading.closest("section")!);
      for (const candidateSlug of nonEmergentUnselected) {
        expect(panel.queryByRole("link", { name: `Open diagnosis: ${titleOf(candidateSlug)}` })).toBeNull();
      }
    }
  });
});
