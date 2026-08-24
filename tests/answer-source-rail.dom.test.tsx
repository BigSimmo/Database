import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/clinical-dashboard/signed-image", () => ({
  SignedImage: ({ caption }: { caption?: string }) => <p>{caption}</p>,
}));

import { AnswerSourceDrawer } from "@/components/clinical-dashboard/answer-source-drawer";
import { AnswerSourceRail } from "@/components/clinical-dashboard/answer-source-rail";
import {
  type AnswerSourceRow,
  answerSourceRailRowId,
  sourceCapsuleDisplay,
  sourceSupportSentence,
} from "@/components/clinical-dashboard/answer-source-rows";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import type { VisualEvidenceCard } from "@/lib/types";

/**
 * The rail and the drawer replaced four separate source surfaces (the "Sources"
 * capsule and its popover/sheet pair, the Evidence sheet, the Clinical notes
 * sheet, and the wide-screen table column), so the behaviours that used to be
 * spread across those are now pinned here.
 *
 * Three of these are contracts rather than preferences:
 *
 * - Compact citations may hide the "Sources" label but never the missing-source
 *   warning, and never the rows themselves — only collapse them behind a chip.
 * - The drawer's support sentence has a null case. Opened from the rail there is
 *   no claim, so it must not assert one.
 * - Tap targets are 48 px. `min-h-11` (44 px) reintroduces a known ui-smoke flake.
 */

function row(overrides: Partial<AnswerSourceRow> & { id: string; title: string }): AnswerSourceRow {
  return {
    documentId: `doc-${overrides.id}`,
    pageNumber: 4,
    metadata: normalizeSourceMetadata(null),
    score: 0.8,
    href: `/documents/${overrides.id}?chunk=${overrides.id}`,
    ...overrides,
  };
}

const SOURCES: AnswerSourceRow[] = [
  row({ id: "s1", title: "Clozapine monitoring protocol", sourceStrength: "strong", snippet: "Check FBC weekly." }),
  row({ id: "s2", title: "Metabolic screening standard", pageNumber: 11, sourceStrength: "limited" }),
  row({
    id: "s3",
    title: "Superseded myocarditis guidance",
    pageNumber: 2,
    sourceStrength: "moderate",
    metadata: normalizeSourceMetadata({ document_status: "outdated" }),
  }),
];

function visualCard(
  overrides: Partial<VisualEvidenceCard> & Pick<VisualEvidenceCard, "id" | "source_chunk_id">,
): VisualEvidenceCard {
  return {
    image_id: overrides.id,
    signed_url_endpoint: `/api/images/${overrides.id}`,
    caption: "Cited figure",
    document_id: "doc-shared",
    title: "Shared protocol",
    file_name: "protocol.pdf",
    page_number: 4,
    chunk_index: 0,
    viewer_href: "/documents/doc-shared",
    ...overrides,
  };
}

function RailAndDrawer({
  sources = SOURCES,
  visualEvidence = [],
}: {
  sources?: AnswerSourceRow[];
  visualEvidence?: VisualEvidenceCard[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <>
      <AnswerSourceRail sources={sources} query="clozapine monitoring" onOpenSource={setOpenIndex} />
      <AnswerSourceDrawer
        sources={sources}
        openIndex={openIndex}
        onOpenIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
        visualEvidence={visualEvidence}
      />
    </>
  );
}

describe("answer source rail", () => {
  it("lists one row per cited document with its page, support and status", () => {
    render(<AnswerSourceRail sources={SOURCES} onOpenSource={vi.fn()} />);
    const rows = screen.getAllByTestId("answer-source-rail-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Clozapine monitoring protocol");

    const rail = screen.getByTestId("answer-source-rail");
    expect(within(rail).getByText("p. 11")).toBeInTheDocument();
    expect(within(rail).getAllByText("Direct").length).toBeGreaterThan(0);
    expect(within(rail).getAllByText("Partial").length).toBeGreaterThan(0);
    // Decision 1: staleness is carried by the row, not by a second mark colour.
    expect(within(rail).getByText("Outdated")).toBeInTheDocument();
  });

  it("keeps every row reachable and links straight to the document when no drawer is mounted", () => {
    render(<AnswerSourceRail sources={SOURCES} query="clozapine" />);
    const rows = screen.getAllByTestId("answer-source-rail-row");
    expect(rows).toHaveLength(3);
    // A historical thread turn mounts no drawer, so a row must navigate rather
    // than advertise a panel that will never open.
    expect(rows[0].tagName).toBe("A");
    expect(rows[0]).toHaveAttribute("href", "/documents/s1?chunk=s1");
  });

  it("does not reuse the live drawer's return-focus ids on a prior-turn rail", () => {
    render(
      <>
        <AnswerSourceRail sources={SOURCES} query="earlier turn" />
        <RailAndDrawer />
      </>,
    );

    const identified = [...document.querySelectorAll("[id^='answer-source-rail-row-']")];
    expect(identified.map((node) => node.id)).toEqual(SOURCES.map((_, index) => answerSourceRailRowId(index)));
    expect(document.getElementById(answerSourceRailRowId(0))?.tagName).toBe("BUTTON");

    const listIds = [...document.querySelectorAll('[role="list"][aria-label="Cited documents"]')].map(
      (node) => node.id,
    );
    expect(listIds).toHaveLength(2);
    expect(new Set(listIds).size).toBe(2);
  });

  it("collapses to a single chip under compact citations and expands back to the same rows", async () => {
    const user = userEvent.setup();
    render(<AnswerSourceRail sources={SOURCES} onOpenSource={vi.fn()} compact />);

    expect(screen.queryAllByTestId("answer-source-rail-row")).toHaveLength(0);
    const toggle = screen.getByTestId("answer-source-rail-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("answer-source-rail-row")).toHaveLength(3);
  });

  it("never hides the missing-source warning, compact or not", () => {
    const { rerender } = render(<AnswerSourceRail sources={[]} onOpenSource={vi.fn()} />);
    expect(screen.getByTestId("answer-source-rail-empty")).toHaveTextContent("No direct source found");

    rerender(<AnswerSourceRail sources={[]} onOpenSource={vi.fn()} compact />);
    expect(screen.getByTestId("answer-source-rail-empty")).toHaveTextContent("No direct source found");
    // The shared derivation agrees, which is what the settings toggle reads.
    expect(sourceCapsuleDisplay({ sourceCount: 0, compact: true }).showLabelText).toBe(true);
  });
});

describe("answer source drawer", () => {
  it("opens on the row that was tapped and pages between sources", async () => {
    const user = userEvent.setup();
    render(<RailAndDrawer />);

    await user.click(screen.getAllByTestId("answer-source-rail-row")[0]);
    const drawer = screen.getByTestId("answer-source-drawer");
    expect(within(drawer).getByText("Clozapine monitoring protocol")).toBeInTheDocument();

    const pager = screen.getByTestId("answer-source-drawer-pager");
    // Three sources still fit the numbered pager; it degrades past four.
    expect(pager).toHaveAttribute("data-pager-variant", "numbered");
    await user.click(within(pager).getByRole("button", { name: "Next source" }));
    expect(
      within(screen.getByTestId("answer-source-drawer")).getByText("Metabolic screening standard"),
    ).toBeInTheDocument();
  });

  it("degrades the pager to prev / n of m above four sources", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 5 }, (_, index) => row({ id: `m${index}`, title: `Source number ${index + 1}` }));
    render(<RailAndDrawer sources={many} />);

    await user.click(screen.getAllByTestId("answer-source-rail-row")[0]);
    const pager = screen.getByTestId("answer-source-drawer-pager");
    expect(pager).toHaveAttribute("data-pager-variant", "compact");
    expect(pager).toHaveTextContent("1 of 5");
  });

  it("does not assert a claim when the drawer was opened from the source list", async () => {
    const user = userEvent.setup();
    render(<RailAndDrawer />);

    await user.click(screen.getAllByTestId("answer-source-rail-row")[0]);
    expect(screen.getByTestId("answer-source-drawer-support")).toHaveTextContent(
      "Opened from the source list, so this is the document, not a claim.",
    );
  });

  it("warns on a source that is past its review date", async () => {
    const user = userEvent.setup();
    render(<RailAndDrawer />);

    await user.click(screen.getAllByTestId("answer-source-rail-row")[2]);
    expect(screen.getByTestId("answer-source-drawer-status")).toHaveTextContent("past its review date");
  });

  it("shows the cited passage when the source carries one", async () => {
    const user = userEvent.setup();
    render(<RailAndDrawer />);

    await user.click(screen.getAllByTestId("answer-source-rail-row")[0]);
    expect(screen.getByTestId("answer-source-drawer-passage")).toHaveTextContent("Check FBC weekly.");
  });

  it("attaches an image only to the rail row that owns its chunk", async () => {
    const user = userEvent.setup();
    const sources = [
      row({ id: "chunk-a", documentId: "doc-shared", title: "Page 4 passage" }),
      row({ id: "chunk-b", documentId: "doc-shared", title: "Page 11 passage" }),
    ];
    render(
      <RailAndDrawer
        sources={sources}
        visualEvidence={[
          visualCard({
            id: "fig-a",
            source_chunk_id: "chunk-a",
            document_id: "doc-shared",
            caption: "Flowchart for chunk A",
          }),
        ]}
      />,
    );

    await user.click(screen.getAllByTestId("answer-source-rail-row")[1]);
    expect(screen.queryByTestId("answer-source-drawer-images")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous source" }));
    expect(screen.getByTestId("answer-source-drawer-images")).toBeInTheDocument();
  });

  it("sends an unmatched image to the first source only", async () => {
    const user = userEvent.setup();
    const sources = [
      row({ id: "chunk-a", documentId: "doc-shared", title: "Page 4 passage" }),
      row({ id: "chunk-b", documentId: "doc-shared", title: "Page 11 passage" }),
    ];
    render(
      <RailAndDrawer
        sources={sources}
        visualEvidence={[
          visualCard({
            id: "fig-orphan",
            source_chunk_id: "orphan-chunk",
            document_id: "doc-shared",
            caption: "Unmatched figure",
          }),
        ]}
      />,
    );

    await user.click(screen.getAllByTestId("answer-source-rail-row")[1]);
    expect(screen.queryByTestId("answer-source-drawer-images")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous source" }));
    expect(screen.getByTestId("answer-source-drawer-images")).toBeInTheDocument();
  });
});

describe("support sentence", () => {
  it("speaks about the claim only when a claim pointed at the source", () => {
    expect(sourceSupportSentence(SOURCES[0], null)).toContain("not a claim");
    expect(sourceSupportSentence(SOURCES[0], 0)).toBe("This page states the claim directly.");
    expect(sourceSupportSentence(SOURCES[1], 1)).toContain("supports part of the claim");
    expect(sourceSupportSentence(row({ id: "x", title: "Unrelated" }), 2)).toContain("does not state the claim");
    expect(sourceSupportSentence(null, 0)).toContain("not a claim");
  });
});
