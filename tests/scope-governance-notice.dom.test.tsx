/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScopeAndGovernanceNotice } from "@/components/clinical-dashboard/answer-content";
import type { SourceGovernanceWarning } from "@/lib/source-governance";

const warnings: SourceGovernanceWarning[] = [
  {
    code: "review_due_source",
    severity: "warning",
    message: "A supporting source is due for review.",
    document_id: "doc-1",
    title: "Lithium Clinical Guideline",
  },
  {
    code: "review_due_source",
    severity: "warning",
    message: "A supporting source is due for review.",
    document_id: "doc-2",
    title: "Lithium Carbonate (IR SR)",
  },
  {
    code: "registry_record_source",
    severity: "info",
    message: "A registry summary was used as supporting evidence.",
    document_id: "doc-3",
    title: "Registry summary",
  },
];

describe("ScopeAndGovernanceNotice", () => {
  it("keeps every governance message and affected-source list on phones", () => {
    render(<ScopeAndGovernanceNotice scope={null} warnings={warnings} />);

    expect(screen.getByText("2 sources due for review.")).toBeVisible();
    expect(screen.getByText(/registry summary used as supporting evidence/i)).toBeVisible();

    const disclosures = screen.getAllByText("Sources affected");
    expect(disclosures).toHaveLength(2);
    expect(screen.getByText("Lithium Clinical Guideline, Lithium Carbonate (IR SR)")).toBeInTheDocument();
  });

  it("drops the amber treatment below sm and restores it from sm up", () => {
    render(<ScopeAndGovernanceNotice scope={null} warnings={warnings} />);

    const notice = screen.getByTestId("source-governance-notice");
    expect(notice).toHaveClass("border-[color:var(--border)]", "bg-[color:var(--surface-subtle)]");
    expect(notice).toHaveClass(
      "sm:border-l-[color:var(--warning)]",
      "sm:bg-[color:var(--warning-soft)]/30",
    );
    expect(notice.className).not.toMatch(/(^|\s)bg-\[color:var\(--warning-soft\)\]/);
  });

  it("renders nothing when there is no scope context and no visible warning", () => {
    const { container } = render(<ScopeAndGovernanceNotice scope={null} warnings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
