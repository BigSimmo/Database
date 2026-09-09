import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnswerInlineSections } from "@/components/clinical-dashboard/answer-inline-sections";
import {
  answerUsesAdaptiveMainSurface,
  projectAnswerForMainSurface,
} from "@/components/clinical-dashboard/answer-section-projector";
import { StagedAnswerResultSurface } from "@/components/clinical-dashboard/answer-result-surface";
import { buildAnswerRenderModel } from "@/lib/answer-render-policy";
import type { ClientRagAnswerPayload, ClientSearchResult } from "@/lib/answer-client-payload";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

function source(id: string, documentId: string, title: string, page: number): ClientSearchResult {
  return {
    id,
    document_id: documentId,
    title,
    file_name: `${documentId}.pdf`,
    page_number: page,
    chunk_index: page,
    section_heading: "Clinical guidance",
    content: `${title} synthetic passage`,
    image_ids: [],
    similarity: 0.95,
    source_metadata: { document_status: "current" },
  };
}

const local = source("chunk-local", "doc-local", "Uploaded local protocol", 4);
const wa = source("chunk-wa", "doc-wa", "WA clinical guideline", 9);
const uncited = source("chunk-unused", "doc-unused", "Uncited retrieval", 2);
const orderedLeadSources = ["A", "B", "C", "D", "E"].map((label, index) =>
  source(`chunk-lead-${label.toLowerCase()}`, `doc-lead-${label.toLowerCase()}`, `Lead source ${label}`, index + 1),
);

function citation(sourceResult: ClientSearchResult) {
  return {
    chunk_id: sourceResult.id,
    document_id: sourceResult.document_id,
    title: sourceResult.title,
    file_name: sourceResult.file_name,
    page_number: sourceResult.page_number,
    chunk_index: sourceResult.chunk_index,
  };
}

function recommendedSource(sourceResult: ClientSearchResult) {
  return {
    ...citation(sourceResult),
    source_strength: "strong" as const,
    score: 0.99,
    snippet: sourceResult.content,
    section_heading: sourceResult.section_heading,
    image_count: 0,
    viewer_href: `/documents/${sourceResult.document_id}?page=${sourceResult.page_number}&chunk=${sourceResult.id}`,
  };
}

function adaptiveAnswer(overrides: Partial<ClientRagAnswerPayload> = {}): ClientRagAnswerPayload {
  return {
    answer: "Source excerpt: **Review** the current plan before treatment.",
    grounded: true,
    confidence: "high",
    citations: [
      {
        chunk_id: local.id,
        document_id: local.document_id,
        title: local.title,
        file_name: local.file_name,
        page_number: local.page_number,
        chunk_index: local.chunk_index,
      },
    ],
    sources: [local, wa, uncited],
    bestSource: {
      chunk_id: wa.id,
      document_id: wa.document_id,
      title: wa.title,
      file_name: wa.file_name,
      page_number: wa.page_number,
      chunk_index: wa.chunk_index,
      source_strength: "strong",
      score: 0.99,
      snippet: wa.content,
      section_heading: wa.section_heading,
      image_count: 0,
      viewer_href: "/documents/doc-wa?page=9&chunk=chunk-wa",
    },
    answerContractVersion: "clinical-rag-answer-v20",
    renderAdaptiveAnswer: true,
    answerSections: [
      {
        heading: "Required action",
        body: "Confirm the **documented dose** before administration.",
        kind: "required_actions",
        supportLevel: "direct",
        citation_chunk_ids: [local.id, local.id],
      },
      {
        heading: "Source difference",
        body: "Uploaded local protocol (primary for this patient) differs from WA clinical guideline (Australia/WA, published 1 January 2026, effective 1 February 2026): review both dose instructions before use.",
        kind: "source_conflict",
        supportLevel: "direct",
        citation_chunk_ids: [local.id, wa.id],
      },
      {
        heading: "Source gap",
        body: "Monitoring frequency: not covered by the active sources.",
        kind: "source_gap",
        supportLevel: "unsupported",
        citation_chunk_ids: [],
      },
    ],
    ...overrides,
  };
}

describe("canonical adaptive answer projection", () => {
  it("keeps the complete lead and every ordered section with only exact final citation ids", () => {
    const answer = adaptiveAnswer();
    const projection = projectAnswerForMainSurface({ answer, sources: answer.sources, preformatted: false });

    expect(projection.leadText).toBe("**Review** the current plan before treatment.");
    expect(projection.leadCitationSources.map((item) => item.id)).toEqual([local.id]);
    expect(projection.sections.map((section) => section.heading)).toEqual([
      "Required action",
      "Source difference",
      "Source gap",
    ]);
    expect(projection.sections.map((section) => section.citationSources.map((item) => item.id))).toEqual([
      [local.id],
      [local.id, wa.id],
      [],
    ]);
    expect(projection.sections[1]?.body).toContain("primary for this patient");
    expect(projection.sections[2]).toMatchObject({ kind: "source_gap", supportLevel: "unsupported" });
  });

  it("requires literal v20 and authoritative final permission without erasing canonical sections", () => {
    const falsePermission = adaptiveAnswer({ renderAdaptiveAnswer: false });
    expect(answerUsesAdaptiveMainSurface(falsePermission)).toBe(false);
    expect(
      projectAnswerForMainSurface({ answer: falsePermission, sources: falsePermission.sources, preformatted: false })
        .sections,
    ).toHaveLength(3);
    expect(answerUsesAdaptiveMainSurface({ ...adaptiveAnswer(), answerContractVersion: undefined })).toBe(false);
    expect(answerUsesAdaptiveMainSurface(adaptiveAnswer())).toBe(true);
  });
});

describe("adaptive answer inline sections", () => {
  it("renders every section once without clipping and activates only its cited sources", async () => {
    const answer = adaptiveAnswer();
    const projection = projectAnswerForMainSurface({ answer, sources: answer.sources, preformatted: false });
    const { container } = render(<AnswerInlineSections sections={projection.sections} />);

    expect(screen.getAllByTestId("adaptive-answer-section")).toHaveLength(3);
    for (const heading of projection.sections.map((section) => section.heading)) {
      expect(screen.getAllByRole("heading", { name: heading })).toHaveLength(1);
    }
    for (const section of container.querySelectorAll('[data-testid="adaptive-answer-section"]')) {
      for (const prose of section.querySelectorAll(":scope > h3, :scope > p")) {
        expect(prose.className).not.toMatch(/line-clamp|truncate|overflow-hidden/);
      }
    }

    const conflict = screen.getAllByTestId("adaptive-answer-section")[1]!;
    expect(within(conflict).getAllByTestId("citation")).toHaveLength(2);
    await userEvent.click(within(conflict).getByRole("button", { name: /WA clinical guideline, p\. 9/i }));
    expect(push).toHaveBeenCalledWith("/documents/doc-wa?page=9&chunk=chunk-wa");
    expect(within(screen.getAllByTestId("adaptive-answer-section")[0]!).getAllByTestId("citation")).toHaveLength(1);
    expect(
      within(screen.getAllByTestId("adaptive-answer-section")[2]!).getByText(answer.answerSections![2]!.body),
    ).toBeVisible();
    expect(screen.queryByText("No source covers this gap.")).not.toBeInTheDocument();
    expect(screen.queryByText("No source supports this statement.")).not.toBeInTheDocument();
  });

  it.each([null, "coverage_gap"] as const)(
    "renders once inside the current %s answer-card path",
    async (fallbackReasonCode) => {
      const answer = adaptiveAnswer(
        fallbackReasonCode
          ? { fallbackReasonCode, degradedMode: { active: true, reason: "The active sources support only part." } }
          : {},
      );
      const renderModel = buildAnswerRenderModel(answer);
      render(
        <StagedAnswerResultSurface
          answer={answer}
          query="What does the plan require?"
          bestSource={answer.bestSource ?? null}
          renderModel={renderModel}
          weakEvidence={false}
          answerViewMode="standard"
          answerEvidenceMapRows={[]}
          onScopeDocument={() => {}}
          answerGrounded
          sources={answer.sources}
          demoMode={false}
          safetyFindings={[]}
          copiedAnswer={false}
          pendingFeedback={null}
          onCopyAnswer={() => {}}
          onSubmitFeedback={() => {}}
        />,
      );

      expect(
        screen.getAllByText((_, element) =>
          Boolean(
            element?.matches("p") && element.textContent === "Confirm the documented dose before administration.",
          ),
        ),
      ).toHaveLength(1);
      expect(screen.getAllByText(/Uploaded local protocol \(primary for this patient\)/)).toHaveLength(1);
      expect(screen.getAllByText("Monitoring frequency: not covered by the active sources.")).toHaveLength(1);
      const answerSurface = screen.getByTestId("plain-answer-response");
      const leadSourceCapsule = within(answerSurface).getByRole("button", { name: "Open answer sources" });
      expect(leadSourceCapsule).toHaveTextContent(/Sources\s*1/);
      await userEvent.click(leadSourceCapsule);
      const leadSourceRows = screen.getAllByTestId("source-capsule-preview-row");
      expect(leadSourceRows).toHaveLength(1);
      expect(leadSourceRows[0]).toHaveAttribute("href", "/documents/doc-local?page=4&chunk=chunk-local");
      expect(leadSourceRows[0]).toHaveAccessibleName(/Uploaded local protocol/i);
      expect(screen.queryByRole("link", { name: /Open source WA clinical guideline/i })).not.toBeInTheDocument();
      expect(within(screen.getAllByTestId("adaptive-answer-section")[1]!).getAllByTestId("citation")).toHaveLength(2);
      expect(screen.queryByText("No source covers this gap.")).not.toBeInTheDocument();
      expect(screen.queryByText("No source supports this statement.")).not.toBeInTheDocument();
      if (fallbackReasonCode) {
        expect(screen.getAllByText("The active sources support only part of this question.")).toHaveLength(1);
      }
    },
  );

  it("does not borrow section or recommended sources when the v20 lead has no citations", () => {
    const answer = adaptiveAnswer({ citations: [] });
    const renderModel = buildAnswerRenderModel(answer);
    render(
      <StagedAnswerResultSurface
        answer={answer}
        query="What does the plan require?"
        bestSource={answer.bestSource ?? null}
        renderModel={renderModel}
        weakEvidence
        answerViewMode="standard"
        answerEvidenceMapRows={[]}
        onScopeDocument={() => {}}
        answerGrounded={false}
        sources={answer.sources}
        demoMode={false}
        safetyFindings={[]}
        copiedAnswer={false}
        pendingFeedback={null}
        onCopyAnswer={() => {}}
        onSubmitFeedback={() => {}}
      />,
    );

    const answerSurface = screen.getByTestId("plain-answer-response");
    expect(within(answerSurface).getByRole("button", { name: "Open answer sources" })).toHaveTextContent(
      "No direct source found",
    );
    expect(screen.queryByTestId("source-capsule-preview-row")).not.toBeInTheDocument();
    expect(within(screen.getAllByTestId("adaptive-answer-section")[1]!).getAllByTestId("citation")).toHaveLength(2);
  });

  it("keeps the first four of five low-trust lead citations in final order before the capsule cap", async () => {
    const answer = adaptiveAnswer({
      confidence: "low",
      citations: orderedLeadSources.map(citation),
      sources: [...orderedLeadSources, wa],
      bestSource: recommendedSource(orderedLeadSources[4]!),
      answerSections: [
        {
          heading: "Ordered lead support",
          body: "All five lead citations support this synthetic statement.",
          kind: "required_actions",
          supportLevel: "direct",
          citation_chunk_ids: orderedLeadSources.map((item) => item.id),
        },
        {
          heading: "Section-only difference",
          body: "The section-only WA source remains independently available.",
          kind: "source_conflict",
          supportLevel: "direct",
          citation_chunk_ids: [orderedLeadSources[0]!.id, wa.id],
        },
      ],
    });
    const renderModel = buildAnswerRenderModel(answer);
    render(
      <StagedAnswerResultSurface
        answer={answer}
        query="Which sources support the lead?"
        bestSource={answer.bestSource ?? null}
        renderModel={renderModel}
        weakEvidence
        answerViewMode="standard"
        answerEvidenceMapRows={[]}
        onScopeDocument={() => {}}
        answerGrounded
        sources={answer.sources}
        demoMode={false}
        safetyFindings={[]}
        copiedAnswer={false}
        pendingFeedback={null}
        onCopyAnswer={() => {}}
        onSubmitFeedback={() => {}}
      />,
    );

    const capsule = within(screen.getByTestId("plain-answer-response")).getByRole("button", {
      name: "Open answer sources",
    });
    expect(capsule).toHaveTextContent(/Sources\s*5/);
    await userEvent.click(capsule);
    expect(screen.getAllByTestId("source-capsule-preview-row").map((row) => row.getAttribute("href"))).toEqual(
      orderedLeadSources
        .slice(0, 4)
        .map((item) => `/documents/${item.document_id}?page=${item.page_number}&chunk=${item.id}`),
    );
    expect(screen.queryByRole("link", { name: /Open source Lead source E/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("Section-only difference").closest('[data-testid="adaptive-answer-section"]'),
    ).toContainElement(screen.getByRole("button", { name: /WA clinical guideline, p\. 9/i }));
  });
});
