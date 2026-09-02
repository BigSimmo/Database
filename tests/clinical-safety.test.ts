import { describe, expect, it } from "vitest";
import {
  collapseDuplicateSafetyFindings,
  extractSafetyFindings,
  sortSafetyFindingsBySeverity,
  type SafetyFinding,
} from "../src/lib/clinical-safety";
import type { RagAnswer } from "../src/lib/types";

const answer: RagAnswer = {
  answer: "Escalate review for urgent warning features.",
  grounded: true,
  confidence: "medium",
  citations: [],
  sources: [
    {
      id: "chunk-1",
      document_id: "doc-1",
      title: "Risk source",
      file_name: "risk.pdf",
      page_number: 1,
      chunk_index: 0,
      section_heading: "Escalation",
      content: "Escalate for urgent review when red flag features are present.",
      image_ids: [],
      similarity: 0.8,
      images: [],
    },
  ],
};

const directRelevance = {
  verdict: "direct" as const,
  label: "Direct match",
  matchedTerms: ["urgent"],
  missingTerms: [],
  directSourceCount: 1,
  weakSourceCount: 0,
  score: 0.9,
  supportReason: "Direct indexed support found.",
  isSourceBacked: true,
};

const nearbyRelevance = {
  verdict: "nearby" as const,
  label: "Nearby only",
  matchedTerms: ["monitoring"],
  missingTerms: ["lithium"],
  directSourceCount: 0,
  weakSourceCount: 1,
  score: 0.32,
  supportReason: "Only nearby indexed passages were found.",
  isSourceBacked: false,
};

describe("clinical safety findings", () => {
  it("extracts only source-backed safety findings from grounded answers", () => {
    const findings = extractSafetyFindings(answer);

    expect(findings).toHaveLength(1);
    expect(findings[0].label).toBe("Red flag");
    expect(findings[0].text).toContain("Escalate for urgent review");
    expect(findings[0].text).not.toContain("Source mentions:");
    expect(findings[0].href).toBe("/documents/doc-1?page=1&chunk=chunk-1");
  });

  it("does not show safety findings for ungrounded answers", () => {
    expect(extractSafetyFindings({ ...answer, grounded: false })).toEqual([]);
  });

  it("suppresses generic safety findings when evidence is nearby only", () => {
    expect(extractSafetyFindings({ ...answer, relevance: nearbyRelevance })).toEqual([]);
  });

  it("keeps safety findings when relevance is source-backed", () => {
    const findings = extractSafetyFindings({
      ...answer,
      relevance: directRelevance,
      sources: answer.sources.map((source) => ({ ...source, source_strength: "moderate" })),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].label).toBe("Red flag");
  });

  it("does not leak internal image or table metadata in safety findings", () => {
    const findings = extractSafetyFindings({
      ...answer,
      quoteCards: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Risk source",
          file_name: "risk.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: null,
          quote:
            "[[IMAGE_DATA_START]] Image ID: img-1; Source kind: table_crop; Image type: clinical_table; Table role: clinical; Table text: | Dose | Route | [[IMAGE_DATA_END]] Monitor blood tests after dose changes.",
        },
      ],
      sources: [],
    });

    expect(findings[0].text).toContain("Monitor blood tests");
    expect(findings[0].text).not.toContain("[[IMAGE_DATA_START]]");
    expect(findings[0].text).not.toContain("Image ID:");
    expect(findings[0].text).not.toContain("Table text:");
  });

  it("removes provenance boilerplate from extracted finding text", () => {
    const findings = extractSafetyFindings({
      ...answer,
      quoteCards: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Risk source",
          file_name: "risk.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: null,
          quote:
            "Source mentions: Procedure PAE-PRO-0338/16 Page 5 of 5. Chunk index: 12. Monitor FBC weekly and escalate urgent toxicity symptoms.",
        },
      ],
      sources: [],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].text).toContain("Monitor FBC weekly");
    expect(findings[0].text).not.toMatch(/Source mentions|PAE-PRO-0338|Page 5 of 5|Chunk index/i);
  });

  it("sorts safety findings by clinical severity", () => {
    const findings: SafetyFinding[] = [
      {
        id: "monitoring:1",
        kind: "monitoring",
        label: "Monitoring",
        text: "Monitor renal function.",
        citation: {
          chunk_id: "1",
          document_id: "doc-1",
          title: "Guide",
          file_name: "guide.pdf",
          page_number: 1,
          chunk_index: 0,
        },
        href: "/documents/doc-1?page=1&chunk=1",
      },
      {
        id: "contraindication:2",
        kind: "contraindication",
        label: "Contraindication",
        text: "Do not use with NSAIDs.",
        citation: {
          chunk_id: "2",
          document_id: "doc-1",
          title: "Guide",
          file_name: "guide.pdf",
          page_number: 2,
          chunk_index: 1,
        },
        href: "/documents/doc-1?page=2&chunk=2",
      },
      {
        id: "caveat:3",
        kind: "caveat",
        label: "Caveat",
        text: "Consider dose adjustment.",
        citation: {
          chunk_id: "3",
          document_id: "doc-1",
          title: "Guide",
          file_name: "guide.pdf",
          page_number: 3,
          chunk_index: 2,
        },
        href: "/documents/doc-1?page=3&chunk=3",
      },
    ];

    const sorted = sortSafetyFindingsBySeverity(findings);

    expect(sorted.map((finding) => finding.kind)).toEqual(["contraindication", "monitoring", "caveat"]);
  });

  it("extracts contraindication findings when words like 'contraindicated' or 'contraindications' are used", () => {
    const contraindicatedAnswer: RagAnswer = {
      answer: "This medication is contraindicated in pregnancy.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [
        {
          id: "chunk-contra",
          document_id: "doc-contra",
          title: "Obstetrics Guide",
          file_name: "obs.pdf",
          page_number: 5,
          chunk_index: 0,
          section_heading: "Safety in Pregnancy",
          content: "This therapy is strictly contraindicated in pregnancy due to teratogenicity risk.",
          image_ids: [],
          similarity: 0.95,
          images: [],
        },
      ],
    };

    const findings = extractSafetyFindings(contraindicatedAnswer);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("contraindication");
    expect(findings[0].label).toBe("Contraindication");
    expect(findings[0].text).toContain("contraindicated in pregnancy");
  });
});

describe("safety findings are counted once per passage", () => {
  // The live clozapine answer reported "3 safety notes" over two passages: the
  // quote card and its own parent chunk both matched, so one passage was listed
  // twice — once as "Red flag" (the longer text reaches that pattern) and once
  // as "Monitoring" (the extract does not). The count is the whole point of the
  // chip that opens this list, so an inflated one is not cosmetic.
  const passage =
    "clozapine safety checkpoints: FBC/ANC monitoring, myocarditis symptom screening, metabolic monitoring, constipation prevention, and shared-care communication.";
  const fullerPassage = `${passage} Urgent review triggers include fever, chest pain, dyspnoea, tachycardia, marked sedation, seizures.`;

  const duplicatedAnswer: RagAnswer = {
    answer: "Clozapine monitoring covers FBC/ANC and myocarditis screening.",
    grounded: true,
    confidence: "medium",
    citations: [],
    quoteCards: [
      {
        chunk_id: "chunk-a",
        document_id: "doc-a",
        title: "Clozapine monitoring protocol",
        file_name: "clozapine.pdf",
        page_number: 1,
        chunk_index: 0,
        similarity: 0.82,
        quote: passage,
      },
    ] as RagAnswer["quoteCards"],
    sources: [
      {
        id: "chunk-a",
        document_id: "doc-a",
        title: "Clozapine monitoring protocol",
        file_name: "clozapine.pdf",
        page_number: 1,
        chunk_index: 0,
        section_heading: "Monitoring",
        content: fullerPassage,
        image_ids: [],
        similarity: 0.82,
        images: [],
      },
      {
        id: "chunk-b",
        document_id: "doc-a",
        title: "Clozapine monitoring protocol",
        file_name: "clozapine.pdf",
        page_number: 2,
        chunk_index: 1,
        section_heading: "Escalation",
        content: "Escalate for urgent review when red flag features are present.",
        image_ids: [],
        similarity: 0.8,
        images: [],
      },
    ],
  };

  it("collapses a quote card into its own parent chunk", () => {
    const findings = extractSafetyFindings(duplicatedAnswer);
    const page1 = findings.filter((finding) => finding.citation.page_number === 1);

    expect(page1).toHaveLength(1);
    // The fuller text survives, and with it the more severe of the two labels.
    expect(page1[0].text).toContain("Urgent review triggers");
    expect(page1[0].label).toBe("Red flag");
    // A genuinely separate passage on another page is untouched.
    expect(findings.filter((finding) => finding.citation.page_number === 2)).toHaveLength(1);
  });

  it("collapses warnings that arrive already computed, not only freshly extracted ones", () => {
    // The server computes these and the client re-reads them, so the guarantee
    // has to hold on the way in as well as at extraction.
    const precomputed = extractSafetyFindings({ ...duplicatedAnswer });
    const doubled = [...precomputed, ...precomputed];

    expect(extractSafetyFindings({ ...duplicatedAnswer, safetyWarnings: doubled })).toHaveLength(precomputed.length);
  });

  it("collapses a short quote against its own parent chunk, under the length floor", () => {
    // The floor exists for the cross-chunk case. A quote card carries its parent
    // chunk's id, so containment there is proof of one passage however short the
    // extract — and applying the floor to it let a short quote double-count
    // against the very chunk it was cut from.
    const fromChunk = (id: string, chunkId: string, text: string, kind: SafetyFinding["kind"]): SafetyFinding => ({
      id,
      kind,
      label: kind === "red_flag" ? "Red flag" : "Monitoring",
      text,
      citation: {
        chunk_id: chunkId,
        document_id: "doc-a",
        title: "Protocol",
        file_name: "p.pdf",
        page_number: 1,
        chunk_index: 0,
        similarity: 0.8,
      },
      href: "/documents/doc-a?page=1",
    });

    const findings = collapseDuplicateSafetyFindings([
      fromChunk("monitoring:chunk-a", "chunk-a", "Monitor ANC weekly.", "monitoring"),
      fromChunk("red_flag:chunk-a", "chunk-a", "Monitor ANC weekly. Urgent review if fever develops.", "red_flag"),
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].text).toContain("Urgent review");
    expect(findings[0].label).toBe("Red flag");
    // The id encodes the kind, so a merge that takes one finding's text and the
    // other's severity has to rebuild it.
    expect(findings[0].id).toBe("red_flag:chunk-a");
  });

  it("reaches a fixed point, so the server and client counts cannot disagree", () => {
    // One pass merges into the FIRST passage-key match, so a finding containing
    // two already-kept ones lands on the first and leaves the second nested
    // inside it. This function runs server-side into the payload and again on
    // the client; a pass short of a fixed point would render "2" then "1".
    const at = (id: string, text: string): SafetyFinding => ({
      id,
      kind: "monitoring",
      label: "Monitoring",
      text,
      citation: {
        chunk_id: id,
        document_id: "doc-a",
        title: "Protocol",
        file_name: "p.pdf",
        page_number: 1,
        chunk_index: 0,
        similarity: 0.8,
      },
      href: "/documents/doc-a?page=1",
    });

    const first = "Monitor full blood count and absolute neutrophil count every week for the first eighteen weeks.";
    const second =
      "Review metabolic parameters at baseline, three months, and then annually thereafter for this patient.";
    const both = `${second} ${first}`;

    const once = collapseDuplicateSafetyFindings([at("a", first), at("b", second), at("c", both)]);
    expect(once).toHaveLength(1);
    // Idempotent: collapsing the output again changes nothing.
    expect(collapseDuplicateSafetyFindings(once)).toEqual(once);
  });

  it("does not merge two short findings that merely share words", () => {
    const short = (id: string, page: number, text: string): SafetyFinding => ({
      id,
      kind: "monitoring",
      label: "Monitoring",
      text,
      citation: {
        chunk_id: id,
        document_id: "doc-a",
        title: "Protocol",
        file_name: "p.pdf",
        page_number: page,
        chunk_index: 0,
        similarity: 0.8,
      },
      href: `/documents/doc-a?page=${page}`,
    });

    // Same page, one text a substring of the other, but far too short to be
    // treated as the same passage.
    const findings = collapseDuplicateSafetyFindings([
      short("a", 1, "Monitor FBC."),
      short("b", 1, "Monitor FBC. Repeat weekly."),
    ]);

    expect(findings).toHaveLength(2);
  });
});
