import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClinicalNotesChecklistPanel } from "@/components/clinical-dashboard/evidence-panels";
import { MobileEvidenceSheetContent } from "@/components/clinical-dashboard/visual-evidence";
import type { AnswerRenderModel } from "@/lib/answer-render-policy";
import type { RagAnswer } from "@/lib/types";
import type { AnswerEvidenceMapRow } from "@/lib/ward-output";

const answer: RagAnswer = {
  answer: "Use the source-backed monitoring plan.",
  grounded: true,
  confidence: "medium",
  citations: [],
  sources: [],
};

const renderModel: AnswerRenderModel = {
  answerText: answer.answer,
  trust: "medium",
  allowedBlocks: ["evidenceMap", "quoteCards", "visualEvidence"],
  primarySources: [],
  reviewSources: [],
  evidenceRows: [],
  quoteCards: [],
  visualEvidence: [],
  relatedDocuments: [],
  bestSource: null,
  warnings: ["Confirm the monitoring interval against the cited guideline."],
  tables: [],
  copyText: answer.answer,
};

const missingSourceRow: AnswerEvidenceMapRow = {
  id: "monitoring-gap",
  section: "Monitoring interval",
  detail: "Confirm the interval against the source guideline.",
  supportLevel: "partial",
  citationCount: 0,
  sourceStatus: "Source unavailable",
  bestSourceLabel: "",
  bestLinkedPassage: "",
};

function evidenceSheetProps() {
  return {
    answer,
    sources: [],
    renderModel,
    visualEvidence: [],
    answerEvidenceMapRows: [missingSourceRow],
    sourceGovernanceWarnings: [],
    demoMode: false,
    pendingFeedback: null,
    copiedQuotes: false,
    onCopyQuotes: vi.fn(),
    onSubmitFeedback: vi.fn(),
    onScopeDocument: vi.fn(),
  };
}

describe("MobileEvidenceSheetContent tabs (jsdom)", () => {
  it("uses unique stable tab and panel ids with reciprocal ARIA associations", () => {
    const props = evidenceSheetProps();
    const { rerender } = render(<MobileEvidenceSheetContent {...props} />);
    const tablist = screen.getByRole("tablist", { name: "Evidence sections" });
    const initialTabIds = within(tablist)
      .getAllByRole("tab")
      .map((tab) => tab.id);

    for (const tab of within(tablist).getAllByRole("tab")) {
      const panelId = tab.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;

      expect(tab.id).not.toBe("");
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }

    const unavailableRow = screen.getByTestId("evidence-map-source-unavailable");
    expect(unavailableRow).toHaveTextContent("Source unavailable");
    expect(within(unavailableRow).queryByRole("link")).not.toBeInTheDocument();

    rerender(<MobileEvidenceSheetContent {...props} />);
    expect(
      within(screen.getByRole("tablist", { name: "Evidence sections" }))
        .getAllByRole("tab")
        .map((tab) => tab.id),
    ).toEqual(initialTabIds);

    rerender(
      <>
        <MobileEvidenceSheetContent {...props} />
        <MobileEvidenceSheetContent {...evidenceSheetProps()} />
      </>,
    );
    const allTabIds = screen.getAllByRole("tab").map((tab) => tab.id);
    const allPanelIds = screen.getAllByRole("tabpanel", { hidden: true }).map((panel) => panel.id);

    expect(new Set(allTabIds).size).toBe(allTabIds.length);
    expect(new Set(allPanelIds).size).toBe(allPanelIds.length);
  });

  it("roves one tab stop and auto-activates Left, Right, Home, and End destinations", async () => {
    const user = userEvent.setup();
    render(<MobileEvidenceSheetContent {...evidenceSheetProps()} />);

    const claims = screen.getByRole("tab", { name: /^Claims/ });
    const quotes = screen.getByRole("tab", { name: /^Quotes/ });
    const images = screen.getByRole("tab", { name: /^Images/ });
    const gaps = screen.getByRole("tab", { name: /^Gaps/ });

    expect(claims).toHaveAttribute("aria-selected", "true");
    expect(claims).toHaveAttribute("tabindex", "0");
    for (const tab of [quotes, images, gaps]) {
      expect(tab).toHaveAttribute("tabindex", "-1");
    }

    claims.focus();
    await user.keyboard("{ArrowRight}");
    expect(quotes).toHaveFocus();
    expect(quotes).toHaveAttribute("aria-selected", "true");
    expect(quotes).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("mobile-evidence-panel-quotes")).not.toHaveAttribute("hidden");

    await user.keyboard("{End}");
    expect(gaps).toHaveFocus();
    expect(gaps).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(claims).toHaveFocus();
    expect(claims).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(gaps).toHaveFocus();
    expect(gaps).toHaveAttribute("aria-selected", "true");
    expect(claims).toHaveAttribute("tabindex", "-1");
  });
});

describe("ClinicalNotesChecklistPanel visual-evidence boundary (jsdom)", () => {
  it("does not expose raw table evidence suppressed by the render model", () => {
    const answerWithRawTable: RagAnswer = {
      ...answer,
      answer: "Monitor renal function and escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
      queryClass: "table_threshold",
      responseMode: "threshold_table",
      citations: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Lithium source",
          file_name: "lithium.pdf",
          page_number: 1,
          chunk_index: 0,
        },
      ],
      answerSections: [
        {
          heading: "Monitoring",
          body: "Check lithium level, renal function, thyroid function, calcium, and interacting medicines.",
          citation_chunk_ids: ["chunk-1"],
          kind: "monitoring_timing",
          supportLevel: "direct",
        },
        {
          heading: "Escalation",
          body: "Escalate review for vomiting, dehydration, tremor, confusion, or ataxia.",
          citation_chunk_ids: ["chunk-1"],
          kind: "escalation_risk",
          supportLevel: "direct",
        },
      ],
      visualEvidence: [
        {
          id: "raw-table",
          document_id: "doc-1",
          image_id: "image-1",
          source_chunk_id: "chunk-1",
          title: "Raw threshold table",
          file_name: "raw-table.pdf",
          page_number: 1,
          chunk_index: 0,
          caption: "Raw table",
          tableColumns: ["Threshold", "Action"],
          tableRows: [
            ["0.49", "Withhold"],
            ["1.0", "Monitor"],
          ],
          signed_url_endpoint: "/api/images/image-1",
          viewer_href: "/documents/doc-1?page=1",
        },
      ],
    };

    render(
      <ClinicalNotesChecklistPanel
        answer={answerWithRawTable}
        visualEvidence={[]}
        viewMode="standard"
        evidenceMapRows={[]}
        bestSource={null}
        copied={false}
        onCopy={vi.fn()}
        onOpenTables={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Tables" })).not.toBeInTheDocument();
    expect(screen.queryByText("0.49")).not.toBeInTheDocument();
    expect(screen.queryByText("Withhold")).not.toBeInTheDocument();
  });

  it("does not reconstruct clinical-notes sections from untrusted answerSections", () => {
    const untrusted: RagAnswer = {
      ...answer,
      grounded: true,
      // Missing relevance.isSourceBacked → fail closed for structured clinical UI.
      answerSections: [
        {
          heading: "Monitoring",
          body: "Check lithium level every 3 months when stable.",
          citation_chunk_ids: ["chunk-1"],
          kind: "monitoring_timing",
          supportLevel: "direct",
        },
        {
          heading: "Escalation",
          body: "Escalate for tremor, confusion, or ataxia.",
          citation_chunk_ids: ["chunk-1"],
          kind: "escalation_risk",
          supportLevel: "direct",
        },
      ],
      quoteCards: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Lithium source",
          file_name: "lithium.pdf",
          page_number: 1,
          quote: "Check lithium level every 3 months when stable.",
        },
      ],
    };

    render(
      <ClinicalNotesChecklistPanel
        answer={untrusted}
        visualEvidence={[]}
        viewMode="standard"
        evidenceMapRows={[]}
        bestSource={null}
        copied={false}
        onCopy={vi.fn()}
        onOpenTables={vi.fn()}
      />,
    );

    expect(screen.queryByText("Check lithium level every 3 months when stable.")).not.toBeInTheDocument();
    expect(screen.queryByText("Escalate for tremor, confusion, or ataxia.")).not.toBeInTheDocument();
  });
});
