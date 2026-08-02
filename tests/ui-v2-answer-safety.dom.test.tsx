import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnswerCard, AnswerFooter, DoseLine, answerClipboardText } from "@/components/ui/answer-card";
import type { AnswerState } from "@/components/ui/answer-state";
import { DateDisplay } from "@/components/ui/date-display";
import { MissingValue } from "@/components/ui/missing-value";
import { RetrievalStateBanner } from "@/components/ui/retrieval-state-banner";
import { VerificationNotice } from "@/components/ui/verification-notice";
import { formatClinicalDate } from "@/lib/source-metadata";

const readyState: AnswerState = { kind: "ready", sourceCount: 4 };

describe("MissingValue", () => {
  it("names the four kinds of absence instead of rendering a dash", () => {
    const { rerender } = render(<MissingValue reason="not_recorded" />);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Not recorded");

    rerender(<MissingValue reason="not_applicable" />);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Not applicable");

    rerender(<MissingValue reason="unknown" />);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Unknown");

    rerender(<MissingValue reason="extraction_failed" />);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Unable to extract");
  });

  it("never abbreviates to a dash, even at cell density", () => {
    render(<MissingValue reason="not_recorded" density="cell" />);
    const node = screen.getByTestId("missing-value");
    expect(node.textContent).toBe("Not recorded");
    expect(node.textContent).not.toBe("-");
    expect(node.textContent).not.toBe("—");
  });

  it("falls back to Unknown for an unrecognised reason rather than throwing", () => {
    // Enum resilience (SPEC §7): an off-vocabulary reason arriving from data must
    // degrade, not unmount the tree.
    const reason = "withheld" as unknown as "unknown";
    expect(() => render(<MissingValue reason={reason} />)).not.toThrow();
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Unknown");
  });
});

describe("DateDisplay", () => {
  it("renders a <time> element carrying the machine value", () => {
    render(<DateDisplay value="2026-03-14" kind="review" />);
    const time = screen.getByText("14/03/2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-03-14");
  });

  it("agrees with formatClinicalDate so provenance strings and elements cannot drift", () => {
    render(<DateDisplay value="2026-03-14" kind="review" />);
    expect(screen.getByText(formatClinicalDate("2026-03-14"))).toBeInTheDocument();
  });

  it("never renders a relative companion for a review date", () => {
    render(<DateDisplay value="2020-01-01" kind="review" relative />);
    expect(screen.queryByTestId("date-display-relative")).not.toBeInTheDocument();
  });

  it("renders an explicit phrase for an absent value", () => {
    render(<DateDisplay value={null} kind="review" missingReason="not_recorded" />);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Not recorded");
  });

  it("degrades an unparseable value to Unknown without throwing", () => {
    expect(() => render(<DateDisplay value="not-a-date" kind="event" />)).not.toThrow();
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Unknown");
  });
});

describe("VerificationNotice", () => {
  it("carries the verification disclaimer even when the answer is ready", () => {
    render(<VerificationNotice state="ready" />);
    // "ready" is not "verified" — the disclaimer is unconditional.
    expect(screen.getByTestId("verification-notice")).toHaveTextContent(/verify/i);
  });

  it("uses a different approved wording for each state", () => {
    const wording = new Set<string>();
    for (const state of ["ready", "stale_evidence", "partial_retrieval", "source_only"] as const) {
      const { unmount } = render(<VerificationNotice state={state} />);
      wording.add(screen.getByTestId("verification-notice").textContent ?? "");
      unmount();
    }
    expect(wording.size).toBe(4);
  });

  it("wears the caution role for stale evidence and never the danger role", () => {
    render(<VerificationNotice state="stale_evidence" />);
    const notice = screen.getByTestId("verification-notice");
    expect(notice.className).toContain("var(--warning)");
    expect(notice.className).not.toContain("var(--danger)");
  });

  it("offers a lay-reader variant with different words from the clinician one", () => {
    const { unmount } = render(<VerificationNotice state="stale_evidence" audience="clinician" />);
    const clinician = screen.getByTestId("verification-notice").textContent;
    unmount();

    render(<VerificationNotice state="stale_evidence" audience="plain" />);
    expect(screen.getByTestId("verification-notice").textContent).not.toBe(clinician);
  });

  it("never names a model or a vendor in any approved wording", () => {
    for (const audience of ["clinician", "plain"] as const) {
      for (const state of ["ready", "stale_evidence", "partial_retrieval", "source_only"] as const) {
        const { unmount } = render(<VerificationNotice state={state} audience={audience} />);
        const text = screen.getByTestId("verification-notice").textContent ?? "";
        expect(text).not.toMatch(/openai|gpt|claude|gemini|\d+%/i);
        unmount();
      }
    }
  });

  it("stamps the print variant with who printed it and when", () => {
    render(<VerificationNotice state="ready" medium="print" printedAt="2026-03-14T02:00:00.000Z" printedBy="Dr Sim" />);
    expect(screen.getByTestId("verification-notice-print-stamp")).toHaveTextContent("Dr Sim");
  });

  it("is not a live region — the announcement is LiveAnnouncer's job", () => {
    render(<VerificationNotice state="stale_evidence" />);
    expect(screen.getByTestId("verification-notice")).not.toHaveAttribute("aria-live");
  });
});

describe("RetrievalStateBanner", () => {
  const overdue = [
    { sourceId: "doc-1", title: "WA Clozapine Protocol", locator: "p. 12", reviewDueOn: "2025-11-01" },
    { sourceId: "doc-2", title: "RANZCP Guideline", reviewDueOn: null },
  ];

  it("names how many of the cited sources are overdue", () => {
    render(<RetrievalStateBanner state={{ kind: "stale_evidence", overdue, sourceCount: 5 }} onOpenSource={vi.fn()} />);
    expect(screen.getByTestId("retrieval-state-headline")).toHaveTextContent("2 of 5 sources");
  });

  it("states totality when every cited source is overdue", () => {
    render(<RetrievalStateBanner state={{ kind: "stale_evidence", overdue, sourceCount: 2 }} onOpenSource={vi.fn()} />);
    expect(screen.getByTestId("retrieval-state-headline")).toHaveTextContent(
      "Every source for this answer is past its review date.",
    );
  });

  it("gives every overdue source a one-click route back to the cited page", async () => {
    const onOpenSource = vi.fn();
    render(
      <RetrievalStateBanner state={{ kind: "stale_evidence", overdue, sourceCount: 2 }} onOpenSource={onOpenSource} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open WA Clozapine Protocol, p. 12" }));
    expect(onOpenSource).toHaveBeenCalledWith("doc-1", "p. 12");
  });

  it("says an overdue source has no recorded review date rather than hiding the row", () => {
    render(<RetrievalStateBanner state={{ kind: "stale_evidence", overdue, sourceCount: 2 }} onOpenSource={vi.fn()} />);

    const rows = screen.getAllByTestId("retrieval-state-overdue-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[1] as HTMLElement).getByTestId("missing-value")).toHaveTextContent("Not recorded");
  });

  it("explains why a source-only answer is still safe to read", () => {
    render(<RetrievalStateBanner state={{ kind: "source_only", reason: "quality_gate" }} onOpenSource={vi.fn()} />);
    expect(screen.getByTestId("retrieval-state-banner")).toHaveTextContent(/quoted from a real, cited source/i);
  });

  it("distinguishes a failed generation from a failed quality check", () => {
    const { unmount } = render(
      <RetrievalStateBanner state={{ kind: "source_only", reason: "generation_failed" }} onOpenSource={vi.fn()} />,
    );
    const failed = screen.getByTestId("retrieval-state-headline").textContent;
    unmount();

    render(<RetrievalStateBanner state={{ kind: "source_only", reason: "quality_gate" }} onOpenSource={vi.fn()} />);
    expect(screen.getByTestId("retrieval-state-headline").textContent).not.toBe(failed);
  });

  it("refuses a partial state that names no missing source", () => {
    // An unnamed gap is a data defect upstream, and inventing "0 sources
    // unavailable" copy would mask it.
    expect(() =>
      render(
        <RetrievalStateBanner
          state={{ kind: "partial_retrieval", retrieved: 3, requested: 5, missing: [] }}
          onOpenSource={vi.fn()}
        />,
      ),
    ).toThrow(/partial_retrieval requires a non-empty/i);
  });

  it("lists missing sources as unavailable rows rather than omitting them", () => {
    render(
      <RetrievalStateBanner
        state={{
          kind: "partial_retrieval",
          retrieved: 3,
          requested: 5,
          missing: [
            { sourceId: "doc-9", title: "Perth Health Formulary" },
            { sourceId: "doc-10", title: "Lithium Monitoring Standard", locator: "p. 3" },
          ],
        }}
        onOpenSource={vi.fn()}
      />,
    );

    expect(screen.getByTestId("retrieval-state-headline")).toHaveTextContent("2 of 5 sources unavailable.");
    expect(screen.getAllByTestId("retrieval-state-missing-row")).toHaveLength(2);
  });

  it("is a labelled group, not a landmark, and not a live region", () => {
    render(<RetrievalStateBanner state={{ kind: "source_only", reason: "quality_gate" }} onOpenSource={vi.fn()} />);
    const banner = screen.getByTestId("retrieval-state-banner");
    expect(banner).toHaveAttribute("role", "group");
    expect(banner).toHaveAccessibleName("How this answer was produced");
    expect(banner).not.toHaveAttribute("aria-live");
  });
});

describe("AnswerCard", () => {
  it("renders the system verification wording above the prose", () => {
    render(
      <AnswerCard state={readyState} verification={{ state: "ready", sourceCount: 4 }}>
        <p>Titrate slowly.</p>
      </AnswerCard>,
    );

    const card = screen.getByTestId("answer-card");
    expect(within(card).getByTestId("verification-notice")).toBeInTheDocument();
    expect(card).toHaveAttribute("data-state", "ready");
  });

  it("shows no retrieval banner for a ready answer", () => {
    render(
      <AnswerCard state={readyState} verification={{ state: "ready" }}>
        <p>Titrate slowly.</p>
      </AnswerCard>,
    );
    expect(screen.queryByTestId("retrieval-state-banner")).not.toBeInTheDocument();
  });

  it("raises the banner for a degraded answer and wires its re-verification route", async () => {
    const onOpenSource = vi.fn();
    render(
      <AnswerCard
        state={{
          kind: "stale_evidence",
          sourceCount: 1,
          overdue: [{ sourceId: "doc-1", title: "WA Clozapine Protocol", locator: "p. 12", reviewDueOn: "2025-11-01" }],
        }}
        verification={{ state: "stale_evidence" }}
        onOpenSource={onOpenSource}
      >
        <p>Titrate slowly.</p>
      </AnswerCard>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open WA Clozapine Protocol, p. 12" }));
    expect(onOpenSource).toHaveBeenCalledWith("doc-1", "p. 12");
  });

  it("wires every declared action", async () => {
    const onActivate = vi.fn();
    render(
      <AnswerCard
        state={readyState}
        verification={{ state: "ready" }}
        actions={[{ id: "copy", label: "Copy answer", onActivate }]}
      >
        <p>Titrate slowly.</p>
      </AnswerCard>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy answer" }));
    expect(onActivate).toHaveBeenCalledOnce();
  });
});

describe("answerClipboardText", () => {
  it("carries the degraded caveat out of the app with the copied text", () => {
    const text = answerClipboardText({
      body: "Start at 12.5 mg.",
      state: { kind: "stale_evidence", sourceCount: 3, overdue: [] },
    });

    expect(text).toContain("Start at 12.5 mg.");
    expect(text).toContain("0 of 3 cited sources are past their review date");
  });

  it("appends provenance through the single audit-line implementation", () => {
    const text = answerClipboardText({ body: "Start at 12.5 mg.", state: readyState });
    // clipboardProvenanceLine() stays the one implementation of the audit line.
    expect(text).toContain("Designation:");
    expect(text).toContain("Review status:");
  });

  it("adds no caveat to a ready answer", () => {
    expect(answerClipboardText({ body: "Start at 12.5 mg.", state: readyState })).not.toContain("Caveat:");
  });
});

describe("DoseLine", () => {
  const rows = [
    {
      id: "clozapine",
      drug: "Clozapine",
      qualifier: "Treatment-resistant schizophrenia",
      dose: { value: "12.5", unit: "mg" },
      frequency: "nocte",
      route: "oral",
      maximum: { value: "900", unit: "mg/day" },
      source: { sourceId: "doc-1", title: "WA Clozapine Protocol", locator: "p. 12" },
      overdue: true,
    },
  ];

  it("marks an overdue row in three channels, not colour alone", () => {
    render(<DoseLine rows={rows} onOpenSource={vi.fn()} />);

    const row = screen.getByTestId("dose-row");
    // 1. the amber inset rule
    expect(row.className).toContain("var(--rule-warning)");
    // 2. the words
    expect(within(row).getByTestId("dose-row-overdue")).toHaveTextContent("Source review overdue");
    // 3. the non-colour shape mark
    expect(within(row).getByTestId("status-mark")).toHaveAttribute("data-status", "review_due");
  });

  it("composes Quantity rather than reimplementing dose typography", () => {
    render(<DoseLine rows={rows} onOpenSource={vi.fn()} />);
    expect(screen.getAllByTestId("quantity-value")[0]).toHaveTextContent("12.5");
    expect(screen.getAllByTestId("quantity-unit")[0]).toHaveTextContent("mg");
  });

  it("opens the cited page from the row", async () => {
    const onOpenSource = vi.fn();
    render(<DoseLine rows={rows} onOpenSource={onOpenSource} />);

    await userEvent.click(screen.getByRole("button", { name: "Open WA Clozapine Protocol, p. 12" }));
    expect(onOpenSource).toHaveBeenCalledWith("doc-1", "p. 12");
  });
});

describe("AnswerFooter", () => {
  it("renders review and generation dates from machine values", () => {
    render(
      <AnswerFooter publisher="RANZCP" version="3.1" reviewDate="2026-03-14" generatedAt="2026-03-14T02:00:00.000Z" />,
    );

    const footer = screen.getByTestId("answer-footer");
    expect(within(footer).getAllByTestId("date-display")).toHaveLength(2);
    expect(footer).toHaveTextContent("14/03/2026");
  });

  it("says an absent field is absent instead of dropping it", () => {
    render(<AnswerFooter publisher="RANZCP" />);

    const footer = screen.getByTestId("answer-footer");
    expect(footer).toHaveTextContent("Version");
    expect(within(footer).getAllByTestId("missing-value").length).toBeGreaterThanOrEqual(1);
  });
});
