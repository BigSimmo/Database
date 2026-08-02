import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnswerCard, AnswerFooter, DoseLine, answerClipboardText, type DoseRow } from "@/components/ui/answer-card";
import type { AnswerState, OverdueSource } from "@/components/ui/answer-state";
import { DateDisplay } from "@/components/ui/date-display";
import { MissingValue } from "@/components/ui/missing-value";
import { RetrievalStateBanner } from "@/components/ui/retrieval-state-banner";
import { VerificationNotice } from "@/components/ui/verification-notice";
import { formatClinicalDate } from "@/lib/source-metadata";

const readyState: AnswerState = { kind: "ready", sourceCount: 4 };

const overdue: OverdueSource[] = [
  {
    sourceId: "doc-1",
    title: "WA Clozapine Protocol",
    locator: "p. 12",
    reviewDueOn: "2025-11-01",
    status: "review_due",
  },
  { sourceId: "doc-2", title: "RANZCP Guideline", reviewDueOn: null, status: "review_due" },
];

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

  it("never invents a time for a date-only generation stamp", () => {
    // "2026-03-14" carries no time. Printing "14/03/2026, 08:00" on a provenance
    // strip states a precision that was never recorded.
    render(<DateDisplay value="2026-03-14" kind="generated" />);
    const node = screen.getByTestId("date-display");
    expect(node).toHaveTextContent("14/03/2026");
    expect(node.textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it("keeps the time on a generation stamp that actually carries one", () => {
    render(<DateDisplay value="2026-03-14T02:00:00.000Z" kind="generated" />);
    expect(screen.getByTestId("date-display").textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("rejects impossible calendar dates that JavaScript would silently roll forward", () => {
    // new Date("2026-02-30") becomes 2 March; provenance must say Unknown instead.
    render(<DateDisplay value="2026-02-30" kind="review" />);
    expect(screen.getByTestId("missing-value")).toHaveTextContent("Unknown");
  });

  it("accepts a real leap-day calendar date", () => {
    render(<DateDisplay value="2024-02-29" kind="review" />);
    expect(screen.getByTestId("date-display")).toHaveTextContent("29/02/2024");
    expect(screen.queryByTestId("missing-value")).not.toBeInTheDocument();
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

  it("does not claim every cited source is overdue in the stale wording", () => {
    // The banner one line below reports the exact fraction; this line must not
    // contradict it by asserting totality.
    render(<VerificationNotice state="stale_evidence" />);
    expect(screen.getByTestId("verification-notice")).toHaveTextContent(/some of which are past their review date/i);
  });

  it("falls back to the most cautionary wording for an unrecognised state, never to ready", () => {
    // Failing open to the neutral variant on a verification notice would weaken
    // the one disclaimer a clinician reads before acting.
    const state = "provenance_unavailable" as unknown as "ready";
    render(<VerificationNotice state={state} />);
    const notice = screen.getByTestId("verification-notice");
    expect(notice).toHaveTextContent(/could not be established/i);
    expect(notice).toHaveTextContent(/unverified/i);
    expect(notice.className).toContain("var(--warning)");
  });
});

describe("RetrievalStateBanner", () => {
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
    const banner = screen.getByTestId("retrieval-state-banner");
    expect(banner).toHaveTextContent(/drawn directly from the cited sources rather than summarised by a model/i);
    // The tier is inferred from the routing mode and the extractive builder
    // composes sections, so verbatim fidelity is not a claim this surface can make.
    expect(banner.textContent).not.toMatch(/nothing has been paraphrased/i);
  });

  it("distinguishes a superseded source from one merely due for review", () => {
    render(
      <RetrievalStateBanner
        state={{
          kind: "stale_evidence",
          sourceCount: 4,
          overdue: [
            { sourceId: "doc-1", title: "Withdrawn Protocol", reviewDueOn: "2024-01-01", status: "outdated" },
            { sourceId: "doc-2", title: "RANZCP Guideline", reviewDueOn: "2025-11-01", status: "review_due" },
          ],
        }}
        onOpenSource={vi.fn()}
      />,
    );

    expect(screen.getByTestId("retrieval-state-headline")).toHaveTextContent("including 1 that has been superseded");
    const rows = screen.getAllByTestId("retrieval-state-overdue-row");
    expect(rows[0]).toHaveAttribute("data-status", "outdated");
    expect(rows[0]).toHaveTextContent(/superseded/i);
    // Shape, not colour: the slashed ring differs from the half ring.
    expect(within(rows[0] as HTMLElement).getByTestId("status-mark")).toHaveAttribute("data-status", "outdated");
    expect(within(rows[1] as HTMLElement).getByTestId("status-mark")).toHaveAttribute("data-status", "review_due");
  });

  it("refuses a stale state that names no overdue source", () => {
    // "0 of 3 sources are past their review date" is a caution arguing against
    // itself. This state has a producer, so an empty list is a defect there.
    expect(() =>
      render(
        <RetrievalStateBanner state={{ kind: "stale_evidence", sourceCount: 3, overdue: [] }} onOpenSource={vi.fn()} />,
      ),
    ).toThrow(/stale_evidence requires a non-empty/i);
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
          overdue: [
            {
              sourceId: "doc-1",
              title: "WA Clozapine Protocol",
              locator: "p. 12",
              reviewDueOn: "2025-11-01",
              status: "review_due",
            },
          ],
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
      state: { kind: "stale_evidence", sourceCount: 3, overdue },
    });

    expect(text).toContain("Start at 12.5 mg.");
    expect(text).toContain("2 of 3 cited sources are past their review date");
  });

  it("never states that zero sources are stale on an answer flagged stale", () => {
    const text = answerClipboardText({
      body: "Start at 12.5 mg.",
      state: { kind: "stale_evidence", sourceCount: 3, overdue: [] },
    });

    expect(text).not.toContain("0 of 3");
    expect(text).toContain("some cited sources are past their review date");
  });

  it("attributes and instructs verification even on a ready answer", () => {
    // A copied answer loses the banner, the notice and the links. Clinical prose
    // with nothing attached reads in a record as though a clinician endorsed it.
    const text = answerClipboardText({ body: "Start at 12.5 mg.", state: readyState });
    expect(text).toContain("AI-generated from the cited sources.");
    expect(text).toContain("Verify against the linked source documents before clinical use.");
  });

  it("names the source-only answer as unsynthesised rather than AI-generated", () => {
    const text = answerClipboardText({
      body: "Start at 12.5 mg.",
      state: { kind: "source_only", reason: "quality_gate" },
    });
    expect(text).toContain("Assembled directly from the cited sources without model synthesis.");
    expect(text).not.toContain("AI-generated");
  });

  it("enumerates the cited sources with their links", () => {
    const text = answerClipboardText({
      body: "Start at 12.5 mg.",
      state: readyState,
      sources: [{ title: "WA Clozapine Protocol", locator: "p. 12", href: "/documents/doc-1" }],
    });

    expect(text).toContain("Sources for review:");
    expect(text).toContain("- WA Clozapine Protocol, p. 12 — /documents/doc-1");
  });

  it("appends provenance through the single audit-line implementation", () => {
    const text = answerClipboardText({ body: "Start at 12.5 mg.", state: readyState });
    // clipboardProvenanceLine() stays the one implementation of the audit line.
    expect(text).toContain("Designation:");
    expect(text).toContain("Review status:");
  });

  it("suppresses the single-document provenance line when it would contradict the caveat", () => {
    // `metadata` describes one document. "1 of 6 cited sources are past their
    // review date" followed by "Review status: Current" reads as a correction.
    const text = answerClipboardText({
      body: "Start at 12.5 mg.",
      state: { kind: "stale_evidence", sourceCount: 6, overdue: [overdue[0] as OverdueSource] },
    });

    expect(text).toContain("1 of 6 cited sources are past their review date");
    expect(text).not.toContain("Review status:");
  });

  it("adds no degraded caveat to a ready answer", () => {
    expect(answerClipboardText({ body: "Start at 12.5 mg.", state: readyState })).not.toContain("Caveat:");
  });
});

describe("DoseLine", () => {
  const rows: DoseRow[] = [
    {
      id: "clozapine",
      drug: "Clozapine",
      qualifier: "Treatment-resistant schizophrenia",
      dose: { value: "12.5", unit: "mg" },
      frequency: "nocte",
      route: "oral",
      maximum: { value: "900", unit: "mg/day" },
      source: { sourceId: "doc-1", title: "WA Clozapine Protocol", locator: "p. 12" },
      status: "review_due",
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

  it("says superseded, not review overdue, for a withdrawn source", () => {
    // The half ring reads "partway through its life". A superseded guideline is
    // not partway through anything.
    render(
      <DoseLine
        rows={[{ ...(rows[0] as DoseRow), status: "outdated", source: rows[0]!.source! }]}
        onOpenSource={vi.fn()}
      />,
    );

    const row = screen.getByTestId("dose-row");
    expect(row).toHaveAttribute("data-status", "outdated");
    expect(within(row).getByTestId("dose-row-overdue")).toHaveTextContent("Source superseded");
    expect(within(row).getByTestId("status-mark")).toHaveAttribute("data-status", "outdated");
  });

  it("renders a current row without the overdue caution", () => {
    render(<DoseLine rows={[{ ...(rows[0] as DoseRow), status: "current" }]} onOpenSource={vi.fn()} />);
    const row = screen.getByTestId("dose-row");
    expect(row).not.toHaveAttribute("data-overdue");
    expect(within(row).queryByTestId("dose-row-overdue")).not.toBeInTheDocument();
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
