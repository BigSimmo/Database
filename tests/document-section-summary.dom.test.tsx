import { fireEvent, render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DocumentSectionSummary } from "@/components/document-viewer/source-panels";

describe("DocumentSectionSummary", () => {
  it("keeps full-view headings non-interactive while condensed summaries toggle", () => {
    const { rerender } = render(
      <details open>
        <DocumentSectionSummary
          icon={FileText}
          title="Indexed source text"
          description="Extracted text"
          interactive={false}
        />
        <p>Body</p>
      </details>,
    );

    const inertSummary = screen.getByText("Indexed source text").closest("summary");
    expect(inertSummary).toHaveAttribute("aria-disabled", "true");
    expect(inertSummary).toHaveAttribute("tabindex", "-1");
    expect(inertSummary?.querySelector("svg.lucide-chevron-down")).toBeNull();
    fireEvent.click(inertSummary!);
    expect(inertSummary?.closest("details")).toHaveProperty("open", true);

    rerender(
      <details>
        <DocumentSectionSummary
          icon={FileText}
          title="Indexed source text"
          description="Extracted text"
          interactive
        />
        <p>Body</p>
      </details>,
    );

    const interactiveSummary = screen.getByText("Indexed source text").closest("summary");
    expect(interactiveSummary).not.toHaveAttribute("aria-disabled");
    expect(interactiveSummary?.querySelector("svg.lucide-chevron-down")).not.toBeNull();
  });
});
