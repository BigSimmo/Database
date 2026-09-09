import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DsmComparisonPage } from "@/components/dsm/dsm-comparison-page";
import { getDsmDiagnosis, listDsmDiagnosisSummaries } from "@/lib/dsm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe("DsmComparisonPage", () => {
  const mdd = getDsmDiagnosis("major-depressive-disorder");
  const bp2 = getDsmDiagnosis("bipolar-ii-disorder");

  it("renders unified comparison without duplicate diagnosis cards when two slots are filled", () => {
    if (!mdd || !bp2) {
      throw new Error("Expected catalogue diagnoses for comparison test");
    }

    const summaries = listDsmDiagnosisSummaries();
    const mddSummary = summaries.find((entry) => entry.slug === mdd.slug);
    const bp2Summary = summaries.find((entry) => entry.slug === bp2.slug);
    if (!mddSummary || !bp2Summary) {
      throw new Error("Expected diagnosis summaries for comparison test");
    }

    render(
      <DsmComparisonPage
        diagnoses={[mdd, bp2]}
        selectedIds={[mdd.slug, bp2.slug, null]}
        catalog={[
          { id: mdd.slug, title: mdd.title, snippet: mddSummary.summary, tag: mdd.icd_code },
          { id: bp2.slug, title: bp2.title, snippet: bp2Summary.summary, tag: bp2.icd_code },
        ]}
        starters={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Compare diagnoses", level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("dsm-comparison-unified")).toBeInTheDocument();
    expect(screen.getByTestId("dsm-comparison-ask-this")).toBeInTheDocument();
    expect(screen.queryByLabelText("Selected diagnoses")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open record/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Differential review/i })).toHaveLength(2);
    expect(
      screen.getByText("Structured review aid — not a diagnostic score. Open each record for complete criteria."),
    ).toBeInTheDocument();
  });
});
