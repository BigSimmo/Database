import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DoseLine, type DoseRow } from "@/components/ui/dose-line";
import { AnswerFooter } from "@/components/answer/AnswerFooter";

describe("DoseLine DOM and Provenance", () => {
  const baseRows: DoseRow[] = [
    {
      id: "clozapine",
      drug: "Clozapine",
      qualifier: "Treatment-resistant schizophrenia",
      dose: { value: "12.5", unit: "mg" },
      frequency: "nocte",
      route: "oral",
      maximum: { value: "900", unit: "mg/day" },
      source: {
        sourceId: "doc-1",
        title: "WA Clozapine Protocol",
        locator: "p. 12",
        metadata: {
          source_kind: "document",
          source_title: "WA Clozapine Protocol",
          document_status: "current",
          jurisdiction: "WA",
          publisher: "WA Health",
        },
      },
      status: "current",
    },
  ];

  it("renders drug, quantity, and route details correctly", () => {
    render(<DoseLine rows={baseRows} onOpenSource={vi.fn()} />);

    expect(screen.getByText("Clozapine")).toBeInTheDocument();
    expect(screen.getByText("Treatment-resistant schizophrenia")).toBeInTheDocument();
    expect(screen.getByText("oral · nocte")).toBeInTheDocument();
    expect(screen.getAllByTestId("quantity-value")[0]).toHaveTextContent("12.5");
    expect(screen.getAllByTestId("quantity-unit")[0]).toHaveTextContent("mg");
  });

  it("renders source provenance badges when present in the payload", () => {
    render(<DoseLine rows={baseRows} onOpenSource={vi.fn()} />);

    const provenance = screen.getByTestId("dose-row-provenance");
    expect(provenance).toBeInTheDocument();
    expect(within(provenance).getByText("Trusted")).toBeInTheDocument();
    expect(within(provenance).getByText("Current source")).toBeInTheDocument();
  });

  it("handles string provenance fallback when metadata object is absent", () => {
    const stringProvRows: DoseRow[] = [
      {
        id: "lithium",
        drug: "Lithium carbonate",
        dose: { value: "450", unit: "mg" },
        status: "current",
        provenance: "RANZCP 2026",
      },
    ];

    render(<DoseLine rows={stringProvRows} onOpenSource={vi.fn()} />);
    const provenance = screen.getByTestId("dose-row-provenance");
    expect(provenance).toHaveTextContent("RANZCP 2026");
  });

  it("marks overdue and superseded rows cleanly", () => {
    const overdueRows: DoseRow[] = [
      {
        id: "olanzapine",
        drug: "Olanzapine",
        dose: { value: "10", unit: "mg" },
        status: "review_due",
        source: {
          sourceId: "doc-2",
          title: "Legacy Psychotropic Guide",
          metadata: {
            source_kind: "document",
            source_title: "Legacy Psychotropic Guide",
            document_status: "review_due",
          },
        },
      },
    ];

    render(<DoseLine rows={overdueRows} onOpenSource={vi.fn()} />);
    const row = screen.getByTestId("dose-row");
    expect(row).toHaveAttribute("data-overdue", "true");
    expect(within(row).getByTestId("dose-row-overdue")).toHaveTextContent("Source review overdue");
    expect(within(row).getByTestId("dose-row-provenance")).toBeInTheDocument();
  });

  it("triggers onOpenSource with source locator", async () => {
    const onOpenSource = vi.fn();
    render(<DoseLine rows={baseRows} onOpenSource={onOpenSource} />);

    const button = screen.getByRole("button", { name: "Open WA Clozapine Protocol, p. 12" });
    await userEvent.click(button);
    expect(onOpenSource).toHaveBeenCalledWith("doc-1", "p. 12");
  });
});

describe("AnswerFooter DOM and Provenance", () => {
  it("renders structured fields and provenance badges when metadata is provided", () => {
    render(
      <AnswerFooter
        publisher="RANZCP"
        version="3.1"
        reviewDate="2026-03-14"
        generatedAt="2026-03-14T02:00:00.000Z"
        metadata={{
          source_kind: "document",
          source_title: "Clinical Practice Guidelines",
          document_status: "current",
          publisher: "Royal Australian and New Zealand College of Psychiatrists",
          publisher_code: "ranzcp",
          jurisdiction: "Australia",
        }}
      />,
    );

    const footer = screen.getByTestId("answer-footer");
    expect(footer).toHaveTextContent("Publisher: RANZCP");
    expect(footer).toHaveTextContent("Version: 3.1");
    expect(footer).toHaveTextContent("14/03/2026");

    const provenance = screen.getByTestId("answer-footer-provenance");
    expect(provenance).toBeInTheDocument();
    expect(within(provenance).getByText("Trusted")).toBeInTheDocument();
    expect(within(provenance).getByText("Current source")).toBeInTheDocument();
  });

  it("renders MissingValue for missing publisher/version without provenance", () => {
    render(<AnswerFooter publisher="" />);

    const footer = screen.getByTestId("answer-footer");
    expect(within(footer).getAllByTestId("missing-value").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("answer-footer-provenance")).not.toBeInTheDocument();
  });
});
