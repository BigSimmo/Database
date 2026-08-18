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

  it("renders a bounded, non-live evidence region without presenting a completed answer", () => {
    render(<AnswerEvidencePreview preview={evidencePreview()} />);

    const region = screen.getByTestId("answer-evidence-preview");
    expect(
      within(region).getByRole("heading", { name: "Selected evidence — answer still being verified" }),
    ).toBeTruthy();
    expect(within(region).getByText(/4 source passages selected/i)).toBeTruthy();
    expect(within(region).getAllByRole("link")).toHaveLength(3);
    expect(region).not.toHaveAttribute("aria-live");
    expect(within(region).queryByText(/answer ready/i)).toBeNull();
  });
});
