import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/clinical-dashboard/signed-image", () => ({
  SignedImage: ({ caption }: { caption?: string }) => <p>{caption}</p>,
}));

vi.mock("@/lib/supabase/client", () => ({
  useAuthSession: () => ({
    authorizationHeader: { Authorization: "Bearer cover-test" },
    session: { user: { id: "cover-test-user" } },
  }),
}));

import { AnswerSourceDrawer } from "@/components/clinical-dashboard/answer-source-drawer";
import { NaturalLanguageAnswer, primaryAnswerDisplayText } from "@/components/clinical-dashboard/answer-content";
import { type AnswerSourceRow } from "@/components/clinical-dashboard/answer-source-rows";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import type { SupportedClaim } from "@/lib/types";

/**
 * The numbered marks in the answer prose.
 *
 * What is pinned here is not how they look but what they are allowed to claim:
 * a mark restates an attribution the answer pipeline already recorded per
 * sentence, and where no such record exists the prose renders unmarked with the
 * source rail underneath still carrying every document. That degrade is the
 * common case on fallback and source-only answers, so it is tested as a
 * behaviour rather than treated as an edge.
 */

const ANSWER =
  "Check the full blood count weekly for the first eighteen weeks. Record every result in the clinical notes.";

const FIRST_SENTENCE = "Check the full blood count weekly for the first eighteen weeks.";

function row(overrides: Partial<AnswerSourceRow> & { id: string; title: string }): AnswerSourceRow {
  return {
    documentId: `doc-${overrides.id}`,
    pageNumber: 8,
    metadata: normalizeSourceMetadata(null),
    score: 0.9,
    href: `/documents/${overrides.id}?chunk=${overrides.id}`,
    cited: true,
    ...overrides,
  };
}

const ROWS: AnswerSourceRow[] = [
  row({ id: "chunk-a", title: "Clozapine monitoring protocol", sourceStrength: "strong" }),
  row({ id: "chunk-b", title: "Metabolic screening standard", pageNumber: 11, sourceStrength: "limited" }),
];

function claim(overrides: Partial<SupportedClaim> & { claimId: string; text: string }): SupportedClaim {
  return {
    riskClass: "routine",
    supportingChunkIds: ["chunk-a"],
    supportStatus: "direct",
    ...overrides,
  };
}

function renderProse({
  claims,
  openSourceIndex = null,
  onOpenSource = vi.fn(),
}: {
  claims?: SupportedClaim[];
  openSourceIndex?: number | null;
  onOpenSource?: (index: number, support?: "direct" | "partial") => void;
}) {
  return render(
    <NaturalLanguageAnswer
      text={ANSWER}
      query="clozapine monitoring"
      sourceOnly={false}
      bestSource={null}
      sources={[]}
      sourceLinks={[]}
      railRows={ROWS}
      claims={claims}
      copied={false}
      onCopy={vi.fn()}
      onOpenSource={onOpenSource}
      openSourceIndex={openSourceIndex}
    />,
  );
}

describe("in-prose source marks", () => {
  it("marks a sentence the pipeline recorded as directly supported, and opens that source", async () => {
    const user = userEvent.setup();
    const onOpenSource = vi.fn();
    renderProse({
      claims: [claim({ claimId: "claim-1", text: FIRST_SENTENCE, supportingChunkIds: ["chunk-b"] })],
      onOpenSource,
    });

    const marks = screen.getAllByTestId("answer-source-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("2");
    await user.click(marks[0]);
    // The chunk the claim named, not the first row and not the row's position in
    // the claim's own citation list.
    expect(onOpenSource).toHaveBeenCalledWith(1, "direct");
  });

  it("renders no marks and still renders the rail when the answer carries no assessed claims", () => {
    // Every fallback and degraded path reaches the surface this way.
    renderProse({ claims: undefined });
    expect(screen.queryAllByTestId("answer-source-mark")).toHaveLength(0);
    expect(screen.getByTestId("answer-source-rail")).toBeInTheDocument();
    expect(screen.getAllByTestId("answer-source-rail-row")).toHaveLength(2);
  });

  it("leaves the displayed prose byte-identical whether or not it carries marks", () => {
    const { unmount } = renderProse({ claims: undefined });
    const plain = screen.getByTestId("plain-answer-prose").textContent;
    unmount();

    renderProse({ claims: [claim({ claimId: "claim-1", text: FIRST_SENTENCE })] });
    const prose = screen.getByTestId("plain-answer-prose");
    // The mark is a button inside the prose, so compare the prose text with the
    // mark's own text removed rather than the whole subtree.
    for (const mark of within(prose).getAllByTestId("answer-source-mark")) mark.remove();
    expect(prose.textContent).toBe(plain);
    expect(prose.textContent).toBe(primaryAnswerDisplayText(ANSWER, { preserveBold: true }));
  });

  it("marks a partially supported sentence differently from a direct one", () => {
    renderProse({
      claims: [claim({ claimId: "claim-1", text: FIRST_SENTENCE, supportStatus: "partial" })],
    });
    const [mark] = screen.getAllByTestId("answer-source-mark");
    expect(mark).toHaveAttribute("data-support", "partial");
    expect(mark).toHaveAccessibleName(/partial support/);
  });

  it("lights the sentence whose source is open, with a cue that survives forced colors", () => {
    renderProse({ claims: [claim({ claimId: "claim-1", text: FIRST_SENTENCE })], openSourceIndex: 0 });
    const claimSpan = screen.getByTestId("answer-claim");
    expect(claimSpan).toHaveAttribute("data-claim-lit", "true");
    // Backgrounds are remapped under forced-colors; the border is painted, so the
    // reader does not lose the sentence they were checking.
    expect(claimSpan.className).toContain("border-l-2");
    expect(screen.getAllByTestId("answer-source-mark")[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("gives the mark and the drawer pager different accessible names", () => {
    // Both controls select "source 2". If they announced identically a screen
    // reader user could not tell the reference from the pager.
    function Harness() {
      const [openIndex, setOpenIndex] = useState<number | null>(0);
      return (
        <>
          <NaturalLanguageAnswer
            text={ANSWER}
            sourceOnly={false}
            bestSource={null}
            sources={[]}
            sourceLinks={[]}
            railRows={ROWS}
            claims={[claim({ claimId: "claim-1", text: FIRST_SENTENCE, supportingChunkIds: ["chunk-b"] })]}
            copied={false}
            onCopy={vi.fn()}
            onOpenSource={setOpenIndex}
            openSourceIndex={openIndex}
          />
          <AnswerSourceDrawer
            sources={ROWS}
            openIndex={openIndex}
            onOpenIndexChange={setOpenIndex}
            onClose={() => setOpenIndex(null)}
          />
        </>
      );
    }
    render(<Harness />);

    expect(screen.getAllByTestId("answer-source-mark")[0]).toHaveAccessibleName(
      /^Source 2: Metabolic screening standard, page 11 — direct support$/,
    );
    const pager = screen.getByTestId("answer-source-drawer-pager");
    expect(within(pager).getByRole("button", { name: /^Show source 2/ })).toBeInTheDocument();
  });

  it("drawer support sentence matches the mark's claim support, not the row strength", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [openIndex, setOpenIndex] = useState<number | null>(null);
      const [claimIndex, setClaimIndex] = useState<number | null>(null);
      const [claimSupport, setClaimSupport] = useState<"direct" | "partial" | null>(null);
      return (
        <>
          <NaturalLanguageAnswer
            text={ANSWER}
            sourceOnly={false}
            bestSource={null}
            sources={[]}
            sourceLinks={[]}
            railRows={ROWS}
            claims={[claim({ claimId: "claim-1", text: FIRST_SENTENCE, supportStatus: "partial" })]}
            copied={false}
            onCopy={vi.fn()}
            onOpenSource={(index, support) => {
              setClaimIndex(index);
              setClaimSupport(support ?? null);
              setOpenIndex(index);
            }}
            onOpenRailSource={(index) => {
              setClaimIndex(null);
              setClaimSupport(null);
              setOpenIndex(index);
            }}
            openSourceIndex={openIndex}
          />
          <AnswerSourceDrawer
            sources={ROWS}
            openIndex={openIndex}
            activeSupportIndex={claimIndex}
            activeClaimSupport={claimSupport}
            onOpenIndexChange={(index) => {
              setClaimIndex(null);
              setClaimSupport(null);
              setOpenIndex(index);
            }}
            onClose={() => {
              setOpenIndex(null);
              setClaimIndex(null);
              setClaimSupport(null);
            }}
          />
        </>
      );
    }
    render(<Harness />);

    await user.click(screen.getAllByTestId("answer-source-mark")[0]);
    // ROWS[0] is strong; the claim is partial. The sentence must follow the mark.
    expect(screen.getByTestId("answer-source-drawer-support")).toHaveTextContent("supports part of the claim");
  });

  it("returns focus to the mark, not the rail, when the drawer closes on that claim's source", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [openIndex, setOpenIndex] = useState<number | null>(null);
      const [claimIndex, setClaimIndex] = useState<number | null>(null);
      return (
        <>
          <NaturalLanguageAnswer
            text={ANSWER}
            sourceOnly={false}
            bestSource={null}
            sources={[]}
            sourceLinks={[]}
            railRows={ROWS}
            claims={[claim({ claimId: "claim-1", text: FIRST_SENTENCE })]}
            copied={false}
            onCopy={vi.fn()}
            onOpenSource={(index) => {
              setClaimIndex(index);
              setOpenIndex(index);
            }}
            onOpenRailSource={(index) => {
              setClaimIndex(null);
              setOpenIndex(index);
            }}
            openSourceIndex={openIndex}
          />
          <AnswerSourceDrawer
            sources={ROWS}
            openIndex={openIndex}
            activeSupportIndex={claimIndex}
            onOpenIndexChange={(index) => {
              setClaimIndex(null);
              setOpenIndex(index);
            }}
            onClose={() => {
              setOpenIndex(null);
              setClaimIndex(null);
            }}
          />
        </>
      );
    }
    render(<Harness />);

    const mark = screen.getAllByTestId("answer-source-mark")[0];
    await user.click(mark);
    expect(screen.getByTestId("answer-source-drawer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    // The reader was mid-sentence. Landing on the rail would lose the sentence
    // the drawer was covering.
    await vi.waitFor(() => expect(mark).toHaveFocus());
  });

  it("never makes a whole sentence unbreakable when a bold run blocks the trailing-word split", () => {
    // `splitTrailingWord` refuses to cut inside a `**…**` run. The fallback used
    // to nowrap the ENTIRE sentence, which on a phone column is a horizontal
    // overflow bug — a much worse outcome than a mark starting the next line.
    const bolded = "Withhold the dose and escalate to the on-call registrar **immediately today**.";
    render(
      <NaturalLanguageAnswer
        text={bolded}
        sourceOnly={false}
        bestSource={null}
        sources={[]}
        sourceLinks={[]}
        railRows={ROWS}
        claims={[claim({ claimId: "claim-1", text: bolded })]}
        copied={false}
        onCopy={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    const claimSpan = screen.getByTestId("answer-claim");
    for (const node of claimSpan.querySelectorAll(".whitespace-nowrap")) {
      // Only the mark cluster may be held together.
      expect(node.textContent?.replace(/\s/g, "")).toBe("1");
    }
  });

  it("does not mark a historical turn, whose rail links out instead of opening a drawer", () => {
    render(
      <NaturalLanguageAnswer
        text={ANSWER}
        sourceOnly={false}
        bestSource={null}
        sources={[]}
        sourceLinks={[]}
        railRows={ROWS}
        claims={[claim({ claimId: "claim-1", text: FIRST_SENTENCE })]}
        copied={false}
        onCopy={vi.fn()}
      />,
    );
    // A prior turn mounts no drawer, so a mark would advertise a panel that never
    // opens.
    expect(screen.queryAllByTestId("answer-source-mark")).toHaveLength(0);
    expect(screen.getAllByTestId("answer-source-rail-row")[0].tagName).toBe("A");
  });
});

describe("source-only disclosure", () => {
  it("folds the governed verification warning into the compact disclosure", async () => {
    const user = userEvent.setup();
    render(
      <NaturalLanguageAnswer
        text={ANSWER}
        query="clozapine monitoring"
        sourceOnly
        sourceOnlyVerificationState="ungrounded"
        bestSource={null}
        sources={[]}
        sourceLinks={[]}
        railRows={ROWS}
        copied={false}
        onCopy={vi.fn()}
      />,
    );

    const disclosure = screen.getByTestId("source-only-disclosure");
    expect(disclosure).toHaveTextContent("Source-only");
    expect(disclosure).not.toHaveTextContent("Copied from cited sources without model synthesis");
    expect(disclosure.className).toContain("text-2xs");
    expect(disclosure.parentElement?.className).not.toContain("py-1");

    await user.click(within(disclosure).getByRole("button", { name: /Source-only/ }));
    expect(disclosure).toHaveTextContent(
      "Copied from cited sources without model synthesis. Sources could not be shown to support every claim. Check each dose, number, timing and threshold before acting.",
    );
  });

  it("no longer renders the overdue control in the answer body", () => {
    // Owner decision, 2026-09-01: the overdue-sources control moved out of the
    // answer body and into the evidence-gaps disclosure, which is where the
    // other statements about this answer's evidence live. `NaturalLanguageAnswer`
    // therefore takes no answer-state props at all any more; the status row it
    // still owns is the Source-only disclosure alone.
    //
    // The caution itself is not hidden by the move — `VerificationNotice` keeps
    // stating it in words on the default view — and the control's new home is
    // pinned by `answer-support-priority.dom.test.tsx`.
    render(
      <NaturalLanguageAnswer
        text={ANSWER}
        query="clozapine monitoring"
        sourceOnly
        sourceOnlyVerificationState="stale_evidence"
        bestSource={null}
        sources={[]}
        sourceLinks={[]}
        railRows={ROWS}
        copied={false}
        onCopy={vi.fn()}
      />,
    );

    const row = screen.getByTestId("answer-source-status-row");
    expect(within(row).getByTestId("source-only-disclosure")).toBeInTheDocument();
    expect(screen.queryByTestId("retrieval-state-stale-toggle")).not.toBeInTheDocument();
  });

  it("renders no status row at all when the answer is synthesized", () => {
    // The row existed for two reasons; one of them has moved out, so a
    // synthesized answer that is merely stale now has nothing to put in it.
    render(
      <NaturalLanguageAnswer
        text={ANSWER}
        query="clozapine monitoring"
        sourceOnly={false}
        bestSource={null}
        sources={[]}
        sourceLinks={[]}
        railRows={ROWS}
        copied={false}
        onCopy={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("answer-source-status-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("retrieval-state-stale-toggle")).not.toBeInTheDocument();
  });
});
