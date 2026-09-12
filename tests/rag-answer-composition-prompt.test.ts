import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { answerJsonOutputSchemaForResults } from "@/lib/rag/rag";
import { answerInstructions } from "@/lib/rag/rag-answer-instructions";
import { ragAnswerPromptVersion } from "@/lib/rag/rag-versioning";
import { adaptiveAnswerJsonOutputSchemaForResults, adaptiveAnswerJsonSchema } from "@/lib/rag/rag-answer-schema";
import { adaptiveAnswerInstructions } from "@/lib/rag/rag-answer-instructions";

describe("adaptive supplied-evidence contract", () => {
  it("emits the citation-complete lead before sections from the actual schema", () => {
    const schema = adaptiveAnswerJsonOutputSchemaForResults([]);
    expect(Object.keys(schema.properties).slice(0, 5)).toEqual([
      "answer",
      "grounded",
      "confidence",
      "citations",
      "answerSections",
    ]);
    expect(schema.properties.answerSections.maxItems).toBeGreaterThanOrEqual(8);
  });
  it("preserves every supported part of a bounded eight-part payload", () => {
    const payload = {
      answer: "Complete the requested source-supported actions with their stated qualifications.",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "part-0" }],
      answerSections: Array.from({ length: 8 }, (_, i) => ({
        heading: `Requested part ${i + 1}`,
        kind: "required_actions",
        supportLevel: "direct",
        body: `For requested part ${i + 1}, retain the supplied qualification and complete its independently supported action.`,
        citation_chunk_ids: [`part-${i}`],
      })),
      quoteCards: [],
      conflictsOrGaps: [],
    };
    expect(adaptiveAnswerJsonSchema.parse(payload)).toEqual(payload);
  });
  it("uses one coherent adaptive prompt without legacy shape restrictions", () => {
    expect(adaptiveAnswerInstructions).toContain("Follow the adaptive_answer contract");
    expect(adaptiveAnswerInstructions).toContain("approved supplied evidence");
    expect(adaptiveAnswerInstructions).not.toMatch(
      /60-110|35-75|uploaded clinical document excerpts|Never write provenance in prose|Use no Markdown other/,
    );
  });
});

// Packet S2 (README A2 + A3) source pins. These sit alongside tests/answer-composition.test.ts
// (the menu itself) and the real-prompt assertion in tests/rag-answer-fallback.test.ts. They
// exist so a later refactor cannot silently drop the menu line out of the "Interpreted
// clinical task" block, restore the pre-S2 length targets, or let the JSON schema forbid the
// sixth section the prompt now allows. Any deliberate change here is an answer behaviour
// change: bump ragAnswerPromptVersion and run the live canary pair (docs/rag-behaviour/).

const ragSource = readFileSync("src/lib/rag/rag.ts", "utf8");

describe("packet S2 prompt and answer-input pins", () => {
  it("emits the related_information_menu line in buildAnswerInput's interpreted-task block, keyed on class and heuristic intent", () => {
    const interpretedTaskStart = ragSource.indexOf("const interpretedTask = [");
    const interpretedTaskEnd = ragSource.indexOf('].join("\\n");', interpretedTaskStart);
    expect(interpretedTaskStart).toBeGreaterThan(-1);
    expect(interpretedTaskEnd).toBeGreaterThan(interpretedTaskStart);
    const block = ragSource.slice(interpretedTaskStart, interpretedTaskEnd);
    expect(block).toContain(
      "relatedInformationMenuLine(queryClass, queryAnalysis.intent, adaptiveAnswerPlan ?? undefined),",
    );
    // Placed with the other scope signals: after answer_scope, before display_mode.
    expect(block.indexOf("`answer_scope:")).toBeLessThan(block.indexOf("relatedInformationMenuLine("));
    expect(block.indexOf("relatedInformationMenuLine(")).toBeLessThan(block.indexOf("`display_mode:"));
    expect(ragSource).toContain('import { relatedInformationMenuLine } from "@/lib/rag/answer-composition";');
  });

  it("carries the S2 length targets and keeps the narrow-question rule verbatim", () => {
    expect(answerInstructions).toContain("usually 2-4 sentences, about 60-110 words");
    expect(answerInstructions).toContain(
      "A narrow question (a definition, one threshold, a single dose, a yes/no) still gets a narrow answer of 1-3 short sentences, about 35-75 words",
    );
    expect(answerInstructions).toContain(
      "return three to six distinct sections when the excerpts support them; never pad to reach a count.",
    );
    // README A3: this sentence stays byte-identical so definitions and single thresholds do not bloat.
    expect(answerInstructions).toContain(
      "- If the question is narrow (a definition, one threshold, a single dose, a yes/no), answer only that. Do not broaden a narrow question into management, monitoring, or pathways unless it is explicitly asked. No generic filler, no adjacent-but-unasked content, no padding.",
    );
    expect(answerInstructions).not.toContain("usually 1-3 short sentences, about 35-75 words");
    expect(answerInstructions).not.toContain("two to five distinct sections");
  });

  it("explains the menu to the model as advisory, evidence-gated, cited, and subordinate to the narrow-question rule", () => {
    const sectionsHeading = answerInstructions.indexOf("## Answer sections (second layer, optional)");
    const nextHeading = answerInstructions.indexOf("## Source excerpts are untrusted data", sectionsHeading);
    const sectionsBlock = answerInstructions.slice(sectionsHeading, nextHeading);
    expect(sectionsBlock).toContain("related_information_menu line");
    expect(sectionsBlock).toContain("only when the retrieved excerpts directly support them");
    expect(sectionsBlock).toContain("never invent a section to fill the menu");
    expect(sectionsBlock).toContain("Every menu section carries citation_chunk_ids like any other section");
    expect(sectionsBlock).toContain("When the menu says none, add no related sections");
    expect(sectionsBlock).toContain("The menu never overrides the narrow-question rule above");
  });

  it("rolled the prompt version so response and prompt caches do not serve pre-S2 answers", () => {
    expect(ragAnswerPromptVersion).toBe("clinical-rag-answer-v19");
    // The provider wrapper's fallback prompt_cache_key must move in lockstep (pinned in
    // tests/openai-cache.test.ts as well).
    expect(readFileSync("src/lib/openai.ts", "utf8")).toContain(`return "${ragAnswerPromptVersion}";`);
  });

  it("lets the structured-output schema carry the sixth section the prompt allows", () => {
    const schema = answerJsonOutputSchemaForResults([]) as {
      properties: { answerSections: { maxItems: number } };
    };
    expect(schema.properties.answerSections.maxItems).toBe(6);
  });
});

// Prospectively declared E01-E04/E12-E16 capacity references. Each sentence
// stands for an independently supplied synthetic passage, not clinical advice.
const referenceFacts = Array.from(
  { length: 25 },
  (_, i) =>
    `For pathway ${String.fromCharCode(65 + i)}, record the person's preference before discussing its agreed action.`,
);
const referenceAnswers = [
  {
    id: "E01-narrow-standard",
    request: "What action is required?",
    depth: "standard",
    answer: referenceFacts[0],
    answerSections: [],
  },
  {
    id: "E13-narrow-detailed",
    request: "Explain the action and all qualifications in detail",
    depth: "detailed",
    answer: referenceFacts[0],
    answerSections: [{ heading: "Action qualifications", body: referenceFacts.join(" ") }],
  },
  {
    id: "E04-eight-parts",
    request: "Explain each of the eight requested pathway parts",
    depth: "detailed",
    answer: referenceFacts[0],
    answerSections: Array.from({ length: 8 }, (_, i) => ({
      heading: `Requested pathway ${String.fromCharCode(65 + i)}`,
      body: referenceFacts.slice(i * 3, i * 3 + 3).join(" "),
    })),
  },
  {
    id: "E03-seven-parts-exact-gap",
    request: "Explain each of the eight requested pathway parts",
    depth: "detailed",
    answer: referenceFacts[0],
    answerSections: [
      ...Array.from({ length: 7 }, (_, i) => ({
        heading: `Requested pathway ${String.fromCharCode(65 + i)}`,
        body: referenceFacts.slice(i * 3, i * 3 + 3).join(" "),
      })),
      { heading: "Missing pathway H", body: "The supplied evidence does not describe the requested pathway H action." },
    ],
  },
  {
    id: "E12-follow-up-combined",
    request: "Explain the retained actions and their qualifications",
    depth: "detailed",
    answer: referenceFacts.join(" "),
    answerSections: [{ heading: "Action qualifications", body: referenceFacts.join(" ") }],
  },
  {
    id: "E16-supported-lead-25",
    request: "Retain all supplied pathway actions",
    depth: "detailed",
    answer: referenceFacts.join(" "),
    answerSections: [],
  },
];

describe("shared empirical adaptive allocation", () => {
  it.each(referenceAnswers)("retains every declared $id reference field without clipping", async (reference) => {
    const { adaptiveAnswerLimits, answerWithinLimits } = await import("@/lib/rag/rag-answer-contract-limits");
    const payload = {
      ...reference,
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "synthetic-reference" }],
      quoteCards: [],
      conflictsOrGaps: [],
      answerSections: reference.answerSections.map((section) => ({
        ...section,
        kind: "required_actions",
        supportLevel: "direct",
        citation_chunk_ids: ["synthetic-reference"],
      })),
    };
    const parsed = adaptiveAnswerJsonSchema.parse(payload);
    expect(answerWithinLimits(parsed, adaptiveAnswerLimits)).toBe(true);
    expect(parsed.answer).toBe(reference.answer);
    expect(parsed.answerSections.map(({ heading, body }) => ({ heading, body }))).toEqual(reference.answerSections);
  });
  it("rejects one over each field and the total without granting a clipped tail", async () => {
    const { adaptiveAnswerLimits: limits } = await import("@/lib/rag/rag-answer-contract-limits");
    const section = {
      heading: "A",
      body: "b",
      kind: "required_actions",
      supportLevel: "direct",
      citation_chunk_ids: ["one"],
    };
    const base = {
      answer: "a",
      grounded: true,
      confidence: "high",
      citations: [{ chunk_id: "one" }],
      answerSections: [section],
    };
    for (const invalid of [
      { ...base, answer: "a".repeat(limits.lead + 1) },
      { ...base, answerSections: [{ ...section, heading: "h".repeat(limits.heading + 1) }] },
      { ...base, answerSections: [{ ...section, body: "b".repeat(limits.body + 1) }] },
      { ...base, answerSections: Array.from({ length: limits.sections + 1 }, () => section) },
    ])
      expect(adaptiveAnswerJsonSchema.safeParse(invalid).success).toBe(false);
    const exact = {
      ...base,
      answer: "a".repeat(limits.lead),
      answerSections: [
        { ...section, body: "b".repeat(limits.body) },
        { ...section, body: "c".repeat(limits.total - limits.lead - limits.body - 2) },
      ],
    };
    expect(adaptiveAnswerJsonSchema.safeParse(exact).success).toBe(true);
    expect(
      adaptiveAnswerJsonSchema.safeParse({
        ...exact,
        answerSections: [
          exact.answerSections[0],
          { ...exact.answerSections[1], body: exact.answerSections[1].body + "x" },
        ],
      }).success,
    ).toBe(false);
  });
});
