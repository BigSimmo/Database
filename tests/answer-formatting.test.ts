import { describe, expect, it } from "vitest";
import {
  answerLinePresentation,
  coerceAnswerDisplayMode,
  parseAnswerDisplayContent,
} from "../src/lib/answer-formatting";

describe("answer display formatting", () => {
  it("parses markdown-style answer bullets into labeled display rows", () => {
    const parsed = parseAnswerDisplayContent(
      "- Monitoring: Check observations after IM medication.\n- Dose detail: Lorazepam **1mg** to **2mg** may be used when supported.",
    );

    expect(parsed.type).toBe("bullets");
    expect(parsed.mode).toBe("clinical_pathway");
    expect(parsed.lines).toMatchObject([
      { label: "Monitoring", text: "Check observations after IM medication." },
      { label: "Dose detail", text: "Lorazepam **1mg** to **2mg** may be used when supported." },
    ]);
    expect(answerLinePresentation(parsed.lines[0])).toMatchObject({ tone: "monitoring", symbol: "⏱" });
    expect(answerLinePresentation(parsed.lines[1])).toMatchObject({ tone: "medication", symbol: "Rx" });
  });

  it("recovers inline bullets after whitespace has been compacted", () => {
    const parsed = parseAnswerDisplayContent(
      "- Bottom line: Use the source-backed pathway. - Escalation/risk: Seek senior review if no response.",
    );

    expect(parsed.type).toBe("bullets");
    expect(parsed.mode).toBe("clinical_pathway");
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].label).toBe("Bottom line");
    expect(parsed.lines[1].label).toBe("Escalation/risk");
    expect(answerLinePresentation(parsed.lines[0])).toMatchObject({ tone: "direct", symbol: "✓" });
    expect(answerLinePresentation(parsed.lines[1])).toMatchObject({ tone: "risk", symbol: "!" });
  });

  it("keeps ordinary prose as a paragraph", () => {
    const parsed = parseAnswerDisplayContent("The indexed source does not contain enough information.");

    expect(parsed.type).toBe("paragraph");
    expect(parsed.mode).toBe("evidence_gap");
    expect(parsed.lines[0]).toMatchObject({
      label: null,
      text: "The indexed source does not contain enough information.",
    });
    expect(answerLinePresentation(parsed.lines[0])).toMatchObject({ tone: "gap", symbol: "?" });
  });

  it("uses checklist mode for practical action answers", () => {
    const parsed = parseAnswerDisplayContent(
      "- Required actions: Complete the source form.\n- Documentation/forms: Record review and consent.",
    );

    expect(parsed.mode).toBe("checklist");
    expect(answerLinePresentation(parsed.lines[0])).toMatchObject({ tone: "action", symbol: "→" });
    expect(answerLinePresentation(parsed.lines[1])).toMatchObject({ tone: "documentation", symbol: "§" });
  });

  it("uses comparison mode and symbols for contrast answers", () => {
    const parsed = parseAnswerDisplayContent(
      "- Comparison: One document describes routine monitoring.\n- Source point: Another source describes escalation criteria.",
    );

    expect(parsed.mode).toBe("comparison");
    expect(answerLinePresentation(parsed.lines[0])).toMatchObject({ tone: "comparison", symbol: "↔" });
    expect(answerLinePresentation(parsed.lines[1])).toMatchObject({ tone: "source", symbol: "#" });
  });

  it("allows explicit response modes to override prose inference", () => {
    const threshold = parseAnswerDisplayContent(
      "ANC below the table threshold requires source verification.",
      "threshold_table",
    );
    const comparison = parseAnswerDisplayContent(
      "- Source A: Routine review.\n- Source B: Escalation criteria.",
      "comparison_matrix",
    );

    expect(threshold.mode).toBe("threshold_table");
    expect(comparison.mode).toBe("comparison_matrix");
    expect(coerceAnswerDisplayMode("document_lookup")).toBe("document_lookup");
  });
});
