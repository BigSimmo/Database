import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import { differentialPresentations, differentialRecords, type DifferentialRecord } from "@/lib/differentials";

const copyText = vi.hoisted(() => vi.fn<(text: string) => Promise<void>>(async () => undefined));
vi.mock("@/lib/copy-to-clipboard", () => ({ copyTextToClipboard: copyText }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Keep the actual comparison renderer and copy button; shell navigation and portals are unrelated.
vi.mock("@/components/mode-nav/registry-mode-nav", () => ({ RegistryModeNav: () => null }));
vi.mock("@/components/clinical-dashboard/phone-footer-layer-portal", () => ({
  PhoneFooterLayerPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => copyText.mockClear());

describe("published presentation candidate rendering", () => {
  it("uses novel and revised public diagnoses for comparison, urgency and copied text, and discloses retired candidates", async () => {
    const bundled = differentialRecords.find((record) => record.status !== "emergent")!;
    const retired = differentialRecords.find((record) => record.slug !== bundled.slug)!;
    const novel: DifferentialRecord = {
      ...bundled,
      slug: "new-public-diagnosis",
      title: "New public diagnosis",
      status: "urgent",
    };
    const revised: DifferentialRecord = { ...bundled, title: "Revised public diagnosis", status: "emergent" };
    const workflow = {
      ...differentialPresentations()[0]!,
      id: "new-public-presentation",
      title: "Published presentation",
      selectedCount: 3,
      totalCount: 3,
      safetySnapshot: {
        ...differentialPresentations()[0]!.safetySnapshot,
        tags: [novel.title, retired.title],
      },
      candidates: [novel, revised, retired].map((record) => ({
        ...differentialPresentations()[0]!.candidates[0]!,
        slug: record.slug,
        selected: true,
        comparison: { "must-not-miss": "Published risk", "immediate-action": "Published action" },
      })),
    };
    render(<DifferentialPresentationWorkflowPage workflow={workflow} candidateRecords={[novel, revised]} />);

    expect(screen.getAllByText(novel.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(revised.title).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: `Open diagnosis: ${novel.title}` }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: `Open diagnosis: ${retired.title}` })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Comparison incomplete: 1 diagnosis record(s)");
    expect(screen.getAllByRole("heading", { name: "Selected differentials (2 of 2)" }).length).toBeGreaterThan(0);
    for (const heading of screen.getAllByRole("heading", { name: "Highest urgency" })) {
      const panel = within(heading.closest("section")!);
      expect(panel.getByRole("link", { name: `Open diagnosis: ${revised.title}` })).toBeInTheDocument();
      expect(panel.queryByRole("link", { name: `Open diagnosis: ${novel.title}` })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getAllByRole("button", { name: "Copy after review" })[0]!);
    await waitFor(() => expect(copyText).toHaveBeenCalledOnce());
    const copied = copyText.mock.calls[0]![0];
    expect(copied).toContain("New public diagnosis (Urgent): Published risk Immediate action: Published action");
    expect(copied).toContain("Revised public diagnosis (Emergency)");
    expect(copied).toContain("Comparison incomplete: 1 diagnosis record(s)");
    expect(copied).not.toContain(`${retired.title} (`);
  });

  it("does not restore bundled candidates when the initialized public catalogue is empty", async () => {
    const workflow = differentialPresentations()[0]!;
    render(<DifferentialPresentationWorkflowPage workflow={workflow} candidateRecords={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Comparison incomplete: ${workflow.candidates.length} diagnosis record(s)`,
    );
    for (const candidate of workflow.candidates) {
      expect(document.querySelector(`[href="/differentials/diagnoses/${candidate.slug}"]`)).toBeNull();
    }
    expect(document.querySelector('[href^="/differentials/diagnoses/"]')).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Copy after review" })[0]!);
    await waitFor(() => expect(copyText).toHaveBeenCalledOnce());
    expect(copyText.mock.calls[0]![0]).toContain("Comparison incomplete");
  });
});

describe("desktop comparison table safety (#0FT00E)", () => {
  // The desktop table scrolls sideways. On acute confusion the EMERGENCY columns
  // for Wernicke and hepatic encephalopathy sat past the right edge with no cue,
  // and the banner claimed "4 of 7 compared" while all 7 rendered.
  const base = differentialPresentations()[0]!;
  const routine = differentialRecords.filter((record) => record.status !== "emergent").slice(0, 3);
  const emergency = differentialRecords.filter((record) => record.status === "emergent").slice(0, 2);
  const ordered = [...routine, ...emergency];
  const mixed = {
    ...base,
    id: "mixed-presentation",
    selectedCount: 1,
    totalCount: ordered.length,
    candidates: ordered.map((record, index) => ({
      ...base.candidates[0]!,
      slug: record.slug,
      selected: index === 0,
      comparison: { "must-not-miss": `Risk ${record.slug}` },
    })),
  };
  const renderMixed = () =>
    render(<DifferentialPresentationWorkflowPage workflow={mixed} candidateRecords={ordered} />);

  it("puts every emergency diagnosis before any other column, even when listed last", () => {
    renderMixed();
    const table = screen.getByRole("table", { name: "Differential comparison" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .slice(1)
      .map((header) => header.textContent ?? "");
    expect(headers).toHaveLength(ordered.length);
    for (const [index, record] of emergency.entries()) expect(headers[index]).toContain(record.title);
    for (const [index, record] of routine.entries()) expect(headers[emergency.length + index]).toContain(record.title);
  });

  it("says how many are selected versus shown, marks unselected columns, and cues the sideways scroll", () => {
    renderMixed();
    const section = screen.getByRole("region", { name: "Differential comparison table" });
    expect(section).toHaveTextContent(`1 of ${ordered.length} diagnoses selected`);
    expect(section).not.toHaveTextContent("diagnoses compared");
    const table = within(section).getByRole("table", { name: "Differential comparison" });
    expect(within(table).getAllByText("Not selected")).toHaveLength(ordered.length - 1);
    const cue = within(section).getByTestId("differential-comparison-scroll-cue");
    expect(cue).toHaveTextContent(`Scroll sideways to see all ${ordered.length} diagnoses`);
    expect(cue).toHaveTextContent("Emergency diagnoses are shown first");
  });

  it("names an all-emergency presentation plainly instead of claiming an order", () => {
    const allEmergency = differentialPresentations().find(
      (workflow) => workflow.id === "acute-confusion-encephalopathy",
    )!;
    render(<DifferentialPresentationWorkflowPage workflow={allEmergency} />);
    const cue = screen.getByTestId("differential-comparison-scroll-cue");
    expect(cue).toHaveTextContent(`All ${allEmergency.candidates.length} are emergency diagnoses`);
  });

  it("gives the sticky criteria column an opaque background so scrolled cells cannot show through", () => {
    renderMixed();
    const table = screen.getByRole("table", { name: "Differential comparison" });
    for (const rowHeader of within(table).getAllByRole("rowheader")) {
      expect(rowHeader.className).toContain("sticky");
      expect(rowHeader.className).not.toContain("bg-inherit");
      expect(rowHeader.className).not.toMatch(/\)\/\d+/);
    }
  });
});
