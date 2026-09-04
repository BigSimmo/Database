import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnswerEvidencePreview,
  visiblePreviewSourceLimit,
} from "@/components/clinical-dashboard/answer-evidence-preview";
import { AnswerProgress } from "@/components/clinical-dashboard/answer-status";
import { incrementalEvidencePreviewRenderingEnabled } from "@/lib/client-env";
import type { VerifiedEvidencePreviewUnit } from "@/lib/answer-stream-contract";
import { normalizeSourceMetadata } from "@/lib/source-metadata";

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
      source_metadata: normalizeSourceMetadata({ document_status: index === 0 ? "review_due" : "current" }),
    })),
  };
}

/** One card lands per `--duration-moderate`; see `useProgressiveReveal` in answer-status.tsx. */
const revealIntervalMs = 200;

function renderProgressWithPreview(preview: VerifiedEvidencePreviewUnit) {
  return render(
    <AnswerProgress
      events={[{ stage: "generating", message: "Drafting.", receivedAt: 0 }]}
      startedAt={0}
      active
      onStop={() => {}}
      evidencePreview={preview}
    />,
  );
}

/** Each card is a separate timeout, scheduled only once the previous card has rendered, so the
 *  clock has to be advanced one rung at a time. Advancing the whole span in a single act block
 *  lands exactly one card — the next timeout does not exist yet. */
function advanceReveal(cards: number) {
  for (let card = 0; card < cards; card += 1) {
    act(() => {
      vi.advanceTimersByTime(revealIntervalMs);
    });
  }
}

/** Past the last card the rail can draw, so assertions read the settled state. */
function settleReveal() {
  advanceReveal(visiblePreviewSourceLimit + 1);
}

describe("incremental answer evidence preview", () => {
  // The reveal is timer-driven, so every render in this file needs a clock it controls.
  // Real timers would make the card count depend on how long the assertion took to run.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-motion");
  });

  // Inverted 2026-08-27 when Phase 1 was enabled by default. The rail is the wait's most
  // useful content and every unit reaching the browser has already passed the stream
  // contract's structural validation, so an unset variable renders it. Only the literal
  // string "false" — the documented second rollback step — withholds it.
  // The unset case reads the ambient variable through the default parameter, so it has to
  // be stubbed away or the assertion only reports what the runner's environment happens to
  // hold — it would pass for the wrong reason locally and fail on a shell that exports the
  // rollback value.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders unless the client gate is explicitly disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_RAG_INCREMENTAL_EVIDENCE_PREVIEW_RENDER", undefined);
    expect(process.env.NEXT_PUBLIC_RAG_INCREMENTAL_EVIDENCE_PREVIEW_RENDER).toBeUndefined();
    expect(incrementalEvidencePreviewRenderingEnabled()).toBe(true);
    expect(incrementalEvidencePreviewRenderingEnabled(undefined)).toBe(true);
    expect(incrementalEvidencePreviewRenderingEnabled("true")).toBe(true);
    expect(incrementalEvidencePreviewRenderingEnabled("false")).toBe(false);
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

  // Freshness is the one fact that decides whether a source should be trusted at
  // all, and it is read through the same helper the arrived answer's rail uses so
  // the wait and the answer can never disagree about a document's status.
  it("shows each source's review status, not its section heading", () => {
    render(<AnswerEvidencePreview preview={evidencePreview(3)} />);

    const cards = within(screen.getByTestId("answer-evidence-preview")).getAllByTestId(
      "answer-evidence-preview-source",
    );
    expect(cards[0]?.textContent).toContain("Review due");
    expect(cards[1]?.textContent).toContain("Current");
    expect(cards[0]?.textContent).not.toContain("Monitoring");
    // And a reader who never sees the card still gets it.
    expect(cards[0]?.getAttribute("aria-label")).toContain("Review due");
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

  // The wait prints exactly one number, and the contract for it is that the reader can
  // count it on screen. A unit may legitimately carry up to twelve sources while the rail
  // draws six, so the line has to read the rail's cap and not the unit's length — "8
  // sources found" above six cards is the one thing this surface promises never to do.
  it("counts only the sources the reader can see, not every source in the unit", () => {
    renderProgressWithPreview(evidencePreview(8));
    settleReveal();

    const cards = screen.getAllByTestId("answer-evidence-preview-source");
    expect(cards).toHaveLength(6);
    expect(screen.getByTestId("answer-progress-line")).toHaveTextContent("6 sources found · writing the answer…");
  });

  // The wait's one copy rule: no number appears that the reader cannot reconcile with
  // something on screen. The cards are revealed one at a time, so the count has to move with
  // them — a line reading "6 sources found" above two cards is the same broken promise as
  // reading the unit's length above the rail's cap.
  it("reveals the cards one at a time with the count tracking what is on screen", () => {
    renderProgressWithPreview(evidencePreview(8));

    const countedSources = () => {
      const match = /(\d+) sources? found/.exec(screen.getByTestId("answer-progress-line").textContent ?? "");
      return match ? Number(match[1]) : 0;
    };

    // The first card is standing the instant the unit arrives — the preview exists to shorten
    // time to first useful content, so nothing is held back for a rung to tidy the animation.
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(1);
    expect(countedSources()).toBe(1);

    advanceReveal(1);
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(2);
    expect(countedSources()).toBe(2);

    advanceReveal(3);
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(5);
    expect(countedSources()).toBe(5);

    // And it stops at the rail's cap rather than walking on toward the unit's eight.
    settleReveal();
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(6);
    expect(countedSources()).toBe(6);
  });

  // The hard-won rule on this surface: suppressing motion must never withhold content.
  // Reduce Motion once left a dead panel on a physical iPhone mid-generation, which is why
  // the reveal fails toward showing everything rather than showing nothing.
  it("shows every card immediately when motion is suppressed", () => {
    document.documentElement.setAttribute("data-motion", "reduced");

    renderProgressWithPreview(evidencePreview(8));

    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(6);
    expect(screen.getByTestId("answer-progress-line")).toHaveTextContent("6 sources found · writing the answer…");
  });

  // The app's Motion preference has three states, and an explicit in-app choice wins over the
  // OS request in BOTH directions — that is what the CSS does
  // (`html:not([data-motion="full"])`), so a JS-gated animation reading the weaker two-state
  // form would freeze this rail alone while the rest of the interface animates.
  it("honours an explicit Full choice over an OS reduce-motion request", () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    document.documentElement.setAttribute("data-motion", "full");

    renderProgressWithPreview(evidencePreview(8));

    // Paced, not dumped: the reader asked for motion and the OS request does not override it.
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(1);
    advanceReveal(2);
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(3);
  });

  // A reader can change the preference while an answer is generating. Suppressing motion fills
  // the rail; re-enabling it must not then take those cards back and re-accrue them.
  it("never takes back a card when the motion preference changes mid-wait", async () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    renderProgressWithPreview(evidencePreview(8));
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(6);

    // `await`, because the preference is watched with a MutationObserver and its callback is a
    // microtask. A synchronous act() would let this assertion pass without the component ever
    // having re-rendered under the new preference — the test would prove nothing.
    await act(async () => {
      document.documentElement.setAttribute("data-motion", "full");
    });

    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(6);
    expect(screen.getByTestId("answer-progress-line")).toHaveTextContent("6 sources found");

    // And it stays put rather than restarting on the next rung.
    advanceReveal(2);
    expect(screen.getAllByTestId("answer-evidence-preview-source")).toHaveLength(6);
  });
});
