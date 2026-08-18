import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import { buildAnswerFollowUpSuggestions } from "@/lib/answer-follow-up";
import type { RagAnswer, SearchResult } from "@/lib/types";

// Packet S3 / README §A4. The follow-up chips render on TWO surfaces — the
// desktop answer surface (`answer-result-surface.tsx`, `hidden sm:block`) and the
// phone composer dock (`master-search-header.tsx`, `sm:hidden`) — and both are fed
// by the same `buildAnswerFollowUpSuggestions` output. This file renders the chip
// component with each call site's exact props so a menu/evidence change is proved
// end-to-end in the DOM, and pins the two call sites so the wiring cannot drift
// away from that function (the same source-contract pattern as
// tests/phone-dock-addon-contract.test.ts).

function read(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const desktopSurface = read("src/components/clinical-dashboard/answer-result-surface.tsx");
const phoneHeader = read("src/components/clinical-dashboard/master-search-header.tsx");
const dashboard = read("src/components/ClinicalDashboard.tsx");

const source: SearchResult = {
  id: "chunk-0",
  document_id: "doc-1",
  title: "WA Lithium Prescribing Guideline",
  file_name: "lithium.pdf",
  page_number: 4,
  chunk_index: 0,
  section_heading: "Prescribing",
  content:
    "Monitor serum lithium levels after each dose change. Cautions and contraindications are listed below. " +
    "Reduce the dose in renal impairment.",
  image_ids: [],
  images: [],
  similarity: 0.71,
};

const answer: RagAnswer = {
  answer: "Start lithium 400 mg nocte and titrate against response.",
  grounded: true,
  confidence: "high",
  citations: [],
  sources: [source],
  queryClass: "medication_dose_risk",
  queryAnalysis: {
    originalQuery: "lithium dosing",
    normalizedQuery: "lithium dosing",
    queryClass: "medication_dose_risk",
    intent: "drug_dosing",
    confidence: 0.9,
    reasons: [],
    canonicalTerms: ["lithium"],
    expandedTerms: [],
    typoCorrections: [],
    medications: ["lithium"],
    acronyms: [],
    thresholdTerms: [],
    documentTitleTerms: [],
    queryRewrite: { normalizedQuery: "lithium dosing", searchQuery: "lithium dosing", expansions: [], reasons: [] },
    documentTitleIntent: false,
    comparisonIntent: false,
    freshnessNeed: false,
    needsVisualEvidence: false,
    needsSynthesis: false,
    needsClassifierFallback: false,
  },
};

const suggestions = buildAnswerFollowUpSuggestions("lithium dosing", answer, ["lithium dosing"]);

/** The desktop call site: default test id, wrap layout (answer-result-surface.tsx). */
function renderDesktop(onPick: (suggestion: string) => void, disabled = false) {
  return render(<AnswerFollowUpSuggestions suggestions={suggestions} onPick={onPick} disabled={disabled} />);
}

/** The phone call site: composer test id, scroll layout (master-search-header.tsx). */
function renderPhone(onPick: (suggestion: string) => void, disabled = false) {
  return render(
    <AnswerFollowUpSuggestions
      suggestions={suggestions}
      onPick={onPick}
      disabled={disabled}
      testId="answer-composer-follow-up-suggestions"
      layout="scroll"
      className="answer-suggestion-row-composer-followups relative z-10 w-full sm:hidden"
    />,
  );
}

describe("answer follow-up chips · menu-derived output reaches both surfaces", () => {
  it("renders the evidence-supported menu chips as wired buttons on the desktop answer surface", async () => {
    const onPick = vi.fn();
    renderDesktop(onPick);

    const row = screen.getByTestId("answer-follow-up-suggestions");
    const chips = within(row).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(suggestions);
    expect(suggestions).toContain("What monitoring is required for lithium?");

    await userEvent.click(chips[0]);
    expect(onPick).toHaveBeenCalledWith(suggestions[0]);
  });

  it("renders the same chips in the phone composer dock row", async () => {
    const onPick = vi.fn();
    renderPhone(onPick);

    const row = screen.getByTestId("answer-composer-follow-up-suggestions");
    expect(row).toHaveClass("answer-suggestion-row-scroll");
    const chips = within(row).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(suggestions);

    await userEvent.click(chips[chips.length - 1]);
    expect(onPick).toHaveBeenCalledWith(suggestions[suggestions.length - 1]);
  });

  it("never renders a chip whose subject the retrieved evidence did not surface", () => {
    renderDesktop(vi.fn());
    const row = screen.getByTestId("answer-follow-up-suggestions");

    // The source snippet says nothing about stopping, escalation or toxicity, so
    // the dosing menu's escalation item must not reach either surface.
    expect(within(row).queryByText(/stopping or escalating/i)).toBeNull();
  });

  it("renders no chip row at all when the gate leaves nothing to suggest", () => {
    const { container } = render(
      <AnswerFollowUpSuggestions
        suggestions={buildAnswerFollowUpSuggestions("lithium dosing", { ...answer, sources: [] }, ["lithium dosing"])}
        onPick={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps chips inert while a request is in flight", () => {
    renderPhone(vi.fn(), true);
    for (const chip of within(screen.getByTestId("answer-composer-follow-up-suggestions")).getAllByRole("button")) {
      expect(chip).toBeDisabled();
    }
  });
});

describe("answer follow-up chips · call-site wiring contract", () => {
  it("keeps both surfaces fed by buildAnswerFollowUpSuggestions", () => {
    expect(dashboard).toContain("buildAnswerFollowUpSuggestions");
    // Desktop: the staged answer surface receives the memoised list.
    expect(dashboard).toContain("followUpSuggestions={answerFollowUpSuggestions}");
    // Phone: the composer dock receives the same list in answer mode.
    expect(dashboard).toContain('composerFollowUpSuggestions={searchMode === "answer" ? answerFollowUpSuggestions');
    expect(desktopSurface).toContain("suggestions={followUpSuggestions}");
    expect(phoneHeader).toContain("suggestions={composerFollowUpSuggestions}");
    expect(phoneHeader).toContain('testId="answer-composer-follow-up-suggestions"');
  });
});
