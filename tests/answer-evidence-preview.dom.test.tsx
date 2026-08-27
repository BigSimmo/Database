import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerEvidencePreview } from "@/components/clinical-dashboard/answer-evidence-preview";
import { incrementalEvidencePreviewRenderingEnabled } from "@/lib/client-env";
import type { VerifiedEvidencePreviewUnit } from "@/lib/answer-stream-contract";

function evidencePreview(sourceCount = 4): VerifiedEvidencePreviewUnit {
  return {
    schemaVersion: 1,
    kind: "evidence_preview",
    sequence: 0,
    selectedContextCount: sourceCount,
    sources: Array.from({ length: sourceCount }, (_, index) => ({
      id: `chunk-${index + 1}`,
      document_id: `doc-${index + 1}`,
      title: `Clinical guideline ${index + 1}`,
      file_name: `guideline-${index + 1}.pdf`,
      page_number: index + 2,
      chunk_index: index,
      section_heading: "Monitoring",
      content: "Review the source passage and confirm the monitoring schedule before clinical use.",
      image_ids: [],
      similarity: 0.8,
      images: [],
    })),
  };
}

describe("incremental answer evidence preview", () => {
  it("keeps its client render flag off unless explicitly enabled", () => {
    expect(incrementalEvidencePreviewRenderingEnabled(undefined)).toBe(false);
    expect(incrementalEvidencePreviewRenderingEnabled("false")).toBe(false);
    expect(incrementalEvidencePreviewRenderingEnabled("true")).toBe(true);
  });

  it("renders a bounded, non-live rail without presenting a completed answer", () => {
    render(<AnswerEvidencePreview preview={evidencePreview(9)} />);

    const region = screen.getByTestId("answer-evidence-preview");
    // Six, matching the render policy's primary-source cap, not the nine offered.
    expect(within(region).getAllByRole("link")).toHaveLength(6);
    expect(region).not.toHaveAttribute("aria-live");
    expect(within(region).queryByText(/answer ready/i)).toBeNull();
    // The old panel announced itself with a heading and a sentence of
    // explanation above the progress panel it duplicated. The rail is content,
    // not a second region to read past.
    expect(within(region).queryByRole("heading")).toBeNull();
  });

  // The single most important invariant on this surface. The preview is the top
  // slice of retrieval in retrieval order; the final list is rebuilt from what
  // the answer actually cites and re-capped by trust. A number assigned here can
  // therefore point at a different document once the answer lands, which is the
  // precise failure the citation design exists to prevent.
  it("never numbers a source before the answer has decided the list", () => {
    render(<AnswerEvidencePreview preview={evidencePreview(4)} />);

    const region = screen.getByTestId("answer-evidence-preview");
    for (const card of within(region).getAllByTestId("answer-evidence-preview-source")) {
      expect(card.textContent ?? "").not.toMatch(/(?:^|\s)[1-9]\s*[.:)]?\s*Clinical guideline/);
      expect(card.querySelector("[aria-hidden='true']")?.textContent?.trim()).toBe("\u2022");
    }
    // The accessible name says so too, for a reader who never sees the dot.
    expect(region.getAttribute("aria-label")).toMatch(/not yet numbered/i);
  });

  it("links every card to the exact page the passage came from", () => {
    render(<AnswerEvidencePreview preview={evidencePreview(2)} />);

    const links = within(screen.getByTestId("answer-evidence-preview")).getAllByRole("link");
    expect(links[0]?.getAttribute("href")).toBe("/documents/doc-1?page=2&chunk=chunk-1");
    expect(links[1]?.getAttribute("href")).toBe("/documents/doc-2?page=3&chunk=chunk-2");
  });

  it("renders nothing rather than an empty frame when the preview carries no sources", () => {
    const { container } = render(<AnswerEvidencePreview preview={evidencePreview(0)} />);
    expect(container.firstChild).toBeNull();
  });
});
