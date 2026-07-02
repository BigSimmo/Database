import type {
  ChunkImage,
  ClinicalDocument,
  DocumentBreakdown,
  IngestionJob,
  RagAnswer,
  SearchResult,
  SmartPanel,
} from "@/lib/types";
import { citationFromResult } from "@/lib/citations";
import {
  buildEvidenceSummary,
  buildDocumentBreakdown,
  buildSmartPanel,
  buildSourceCoverage,
  buildVisualEvidence,
  detectConflictsOrGaps,
  extractQuoteCards,
  selectBestSourceRecommendation,
  sourceStrengthForSimilarity,
} from "@/lib/evidence";

const now = "2026-05-18T10:00:00.000+08:00";
const syntheticMetadata = {
  source_title: "Synthetic demonstration source",
  publisher: "Clinical KB demo",
  jurisdiction: "Australia/WA",
  version: "demo",
  publication_date: null,
  review_date: null,
  uploaded_at: now,
  indexed_at: now,
  uploaded_by: null,
  document_status: "unknown" as const,
  clinical_validation_status: "unverified" as const,
  extraction_quality: "good" as const,
};

export const demoDocuments: ClinicalDocument[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Synthetic lithium monitoring protocol",
    description: "Synthetic PDF text extraction demo document. Not clinical guidance.",
    file_name: "synthetic-lithium-monitoring.pdf",
    file_type: "application/pdf",
    file_size: 2302,
    storage_path: "/demo-documents/synthetic-lithium-monitoring.pdf",
    status: "indexed",
    page_count: 1,
    chunk_count: 2,
    image_count: 0,
    error_message: null,
    metadata: syntheticMetadata,
    created_at: now,
    updated_at: now,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Synthetic clozapine monitoring protocol with image evidence",
    description: "Synthetic PDF with an embedded monitoring table image. Not clinical guidance.",
    file_name: "synthetic-clozapine-monitoring-with-image.pdf",
    file_type: "application/pdf",
    file_size: 62170,
    storage_path: "/demo-documents/synthetic-clozapine-monitoring-with-image.pdf",
    status: "indexed",
    page_count: 2,
    chunk_count: 3,
    image_count: 1,
    error_message: null,
    metadata: syntheticMetadata,
    created_at: now,
    updated_at: now,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Synthetic acute risk triage flow with image evidence",
    description: "Synthetic PDF with risk flowchart image. Not clinical guidance.",
    file_name: "synthetic-risk-flow-with-image.pdf",
    file_type: "application/pdf",
    file_size: 62829,
    storage_path: "/demo-documents/synthetic-risk-flow-with-image.pdf",
    status: "indexed",
    page_count: 2,
    chunk_count: 3,
    image_count: 1,
    error_message: null,
    metadata: syntheticMetadata,
    created_at: now,
    updated_at: now,
  },
];

export const demoImages: Array<ChunkImage & { document_id: string; mime_type: string }> = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    document_id: "22222222-2222-4222-8222-222222222222",
    page_number: 2,
    storage_path: "/demo-documents/clozapine-table.png",
    signed_url: "/demo-documents/clozapine-table.png",
    mime_type: "image/png",
    image_type: "clinical_table",
    searchable: true,
    clinical_relevance_score: 0.9,
    source_kind: "embedded",
    clinicalUseClass: "clinical_evidence",
    clinicalUseReason: "demo clinical monitoring table",
    tableColumns: ["Domain", "Baseline", "Initiation", "Ongoing"],
    tableRows: [
      ["FBC/ANC", "Record baseline result", "Monitor per protocol", "Continue scheduled monitoring"],
      [
        "Myocarditis",
        "Review cardiac symptoms",
        "Check symptoms and markers if required",
        "Escalate concerning symptoms",
      ],
      ["Metabolic", "Weight, lipids, glucose/HbA1c", "Track early change", "Ongoing metabolic review"],
      ["Constipation", "Document bowel history", "Plan prevention", "Escalate severe constipation"],
    ],
    accessibleTableMarkdown:
      "| Domain | Baseline | Initiation | Ongoing |\n| --- | --- | --- | --- |\n| FBC/ANC | Record baseline result | Monitor per protocol | Continue scheduled monitoring |\n| Myocarditis | Review cardiac symptoms | Check symptoms and markers if required | Escalate concerning symptoms |\n| Metabolic | Weight, lipids, glucose/HbA1c | Track early change | Ongoing metabolic review |\n| Constipation | Document bowel history | Plan prevention | Escalate severe constipation |",
    caption:
      "Synthetic clozapine monitoring table showing domains for FBC/ANC, myocarditis, metabolic review, and constipation planning across baseline, initiation, and ongoing care.",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    document_id: "33333333-3333-4333-8333-333333333333",
    page_number: 2,
    storage_path: "/demo-documents/risk-flow.png",
    signed_url: "/demo-documents/risk-flow.png",
    mime_type: "image/png",
    image_type: "flowchart_algorithm",
    searchable: true,
    clinical_relevance_score: 0.88,
    source_kind: "embedded",
    clinicalUseClass: "clinical_evidence",
    clinicalUseReason: "demo clinical risk escalation workflow",
    caption:
      "Synthetic acute risk triage flow linking immediate safety, current intent, means restriction, protective factors, and senior review.",
  },
];

export const demoPages = [
  {
    id: "page-lithium-1",
    document_id: "11111111-1111-4111-8111-111111111111",
    page_number: 1,
    ocr_used: false,
    metadata: {},
    text: "Synthetic lithium monitoring protocol. Synthetic test document for RAG demonstration only. Not a clinical guideline and not medical advice.\n\nLithium baseline checklist: Confirm indication, formulation, target range, recent renal function, thyroid function, calcium, weight, blood pressure, and current interacting medicines. Record baseline mood symptoms and risk context. For the synthetic Perth clinic workflow, document the monitoring owner and the review interval before prescribing.\n\nMonitoring schedule: In this synthetic protocol, check lithium level 5 to 7 days after initiation or dose change, then repeat until stable. After stability, the sample schedule uses lithium level every 3 months, renal and thyroid tests every 6 months, and calcium annually. Escalate review when there is vomiting, diarrhoea, dehydration, acute kidney injury, new NSAID/ACE inhibitor/diuretic exposure, tremor, confusion, or ataxia.",
  },
  {
    id: "page-clozapine-1",
    document_id: "22222222-2222-4222-8222-222222222222",
    page_number: 1,
    ocr_used: false,
    metadata: {},
    text: "Synthetic clozapine monitoring protocol with image evidence. This synthetic document emphasises FBC/ANC monitoring, myocarditis symptom screening, metabolic monitoring, constipation prevention, and shared-care communication. A source answer should mention that fever, chest pain, dyspnoea, tachycardia, marked sedation, seizures, or severe constipation require urgent review. Baseline: FBC/ANC, ECG if indicated, troponin/CRP if local protocol requires, weight, waist, lipids, glucose/HbA1c, smoking status, bowel history, and medicine reconciliation.",
  },
  {
    id: "page-clozapine-2",
    document_id: "22222222-2222-4222-8222-222222222222",
    page_number: 2,
    ocr_used: false,
    metadata: {},
    text: "Embedded image evidence. The synthetic clozapine monitoring table should be extracted, captioned, and inserted into searchable chunk context. The table covers FBC/ANC, myocarditis, metabolic monitoring, and constipation planning across baseline, initiation, and ongoing care.",
  },
  {
    id: "page-risk-1",
    document_id: "33333333-3333-4333-8333-333333333333",
    page_number: 1,
    ocr_used: false,
    metadata: {},
    text: "Synthetic acute risk triage flow with image evidence. The synthetic WA-style triage flow separates immediate safety, mental state, substance use, supports, means restriction, protective factors, and follow-up plan. Escalate in this test document for current intent, recent attempt, command hallucinations, severe agitation, intoxication with unsafe behaviour, inability to collaborate on safety planning, or absent supervision.",
  },
  {
    id: "page-risk-2",
    document_id: "33333333-3333-4333-8333-333333333333",
    page_number: 2,
    ocr_used: false,
    metadata: {},
    text: "Embedded image evidence. The acute risk flowchart shows immediate safety, current intent, means restriction, protective factors, and senior review as linked triage steps.",
  },
];

export const demoChunks: SearchResult[] = [
  {
    id: "44444444-4444-4444-8444-444444444441",
    document_id: demoDocuments[0].id,
    title: demoDocuments[0].title,
    file_name: demoDocuments[0].file_name,
    page_number: 1,
    chunk_index: 0,
    section_heading: "Lithium baseline checklist",
    content:
      "Lithium baseline checklist: Confirm indication, formulation, target range, renal function, thyroid function, calcium, weight, blood pressure, current interacting medicines, baseline mood symptoms, risk context, monitoring owner, and review interval before prescribing.",
    image_ids: [],
    similarity: 0.91,
    source_metadata: syntheticMetadata,
    images: [],
  },
  {
    id: "44444444-4444-4444-8444-444444444442",
    document_id: demoDocuments[0].id,
    title: demoDocuments[0].title,
    file_name: demoDocuments[0].file_name,
    page_number: 1,
    chunk_index: 1,
    section_heading: "Lithium toxicity safety net",
    content:
      "Escalate review when there is vomiting, diarrhoea, dehydration, acute kidney injury, new NSAID/ACE inhibitor/diuretic exposure, tremor, confusion, or ataxia. Lithium levels are checked 5 to 7 days after initiation or dose change, then repeated until stable.",
    image_ids: [],
    similarity: 0.93,
    source_metadata: syntheticMetadata,
    images: [],
  },
  {
    id: "55555555-5555-4555-8555-555555555551",
    document_id: demoDocuments[1].id,
    title: demoDocuments[1].title,
    file_name: demoDocuments[1].file_name,
    page_number: 1,
    chunk_index: 0,
    section_heading: "Clozapine safety checkpoints",
    content:
      "Clozapine safety checkpoints: FBC/ANC monitoring, myocarditis symptom screening, metabolic monitoring, constipation prevention, and shared-care communication. Urgent review triggers include fever, chest pain, dyspnoea, tachycardia, marked sedation, seizures, or severe constipation.",
    image_ids: [],
    similarity: 0.88,
    source_metadata: syntheticMetadata,
    images: [],
  },
  {
    id: "55555555-5555-4555-8555-555555555552",
    document_id: demoDocuments[1].id,
    title: demoDocuments[1].title,
    file_name: demoDocuments[1].file_name,
    page_number: 2,
    chunk_index: 1,
    section_heading: "Clozapine table image evidence",
    content:
      "[[IMAGE_DATA_START]] Image ID: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; Description: Synthetic clozapine monitoring table showing domains for FBC/ANC, myocarditis, metabolic review, and constipation planning across baseline, initiation, and ongoing care. [[IMAGE_DATA_END]]",
    image_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    similarity: 0.94,
    source_metadata: syntheticMetadata,
    images: [demoImages[0]],
  },
  {
    id: "66666666-6666-4666-8666-666666666661",
    document_id: demoDocuments[2].id,
    title: demoDocuments[2].title,
    file_name: demoDocuments[2].file_name,
    page_number: 1,
    chunk_index: 0,
    section_heading: "Acute risk escalation triggers",
    content:
      "Escalate for current intent, recent attempt, command hallucinations, severe agitation, intoxication with unsafe behaviour, inability to collaborate on safety planning, or absent supervision. The synthetic WA-style triage flow separates immediate safety, mental state, substance use, supports, means restriction, protective factors, and follow-up plan.",
    image_ids: [],
    similarity: 0.92,
    source_metadata: syntheticMetadata,
    images: [],
  },
  {
    id: "66666666-6666-4666-8666-666666666662",
    document_id: demoDocuments[2].id,
    title: demoDocuments[2].title,
    file_name: demoDocuments[2].file_name,
    page_number: 2,
    chunk_index: 1,
    section_heading: "Acute risk flowchart image evidence",
    content:
      "[[IMAGE_DATA_START]] Image ID: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb; Description: Synthetic acute risk triage flow linking immediate safety, current intent, means restriction, protective factors, and senior review. [[IMAGE_DATA_END]]",
    image_ids: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    similarity: 0.9,
    source_metadata: syntheticMetadata,
    images: [demoImages[1]],
  },
];

export const demoJobs: IngestionJob[] = demoDocuments.map((document, index) => ({
  id: `77777777-7777-4777-8777-77777777777${index + 1}`,
  document_id: document.id,
  status: "completed",
  stage: "indexed demo document",
  progress: 100,
  error_message: null,
  created_at: now,
  updated_at: now,
}));

export function getDemoDocument(id: string) {
  return demoDocuments.find((document) => document.id === id) ?? null;
}

export function getDemoDocumentPayload(id: string, chunkId?: string | null) {
  const document = getDemoDocument(id);
  if (!document) return null;
  const pages = demoPages.filter((page) => page.document_id === id);
  const images = demoImages.filter((image) => image.document_id === id);
  const chunks = demoChunks
    .filter((chunk) => chunk.document_id === id)
    .filter((chunk) => !chunkId || chunk.id === chunkId)
    .map((chunk) => ({
      id: chunk.id,
      document_id: chunk.document_id,
      page_number: chunk.page_number,
      chunk_index: chunk.chunk_index,
      section_heading: chunk.section_heading,
      content: chunk.content,
      image_ids: chunk.image_ids,
    }));

  return { document, pages, images, chunks };
}

const queryTerms: Record<string, string[]> = {
  lithium: ["lithium", "toxicity", "renal", "thyroid", "ataxia", "tremor", "dehydration"],
  clozapine: ["clozapine", "fbc", "anc", "myocarditis", "constipation", "table", "image"],
  risk: ["risk", "acute", "escalate", "senior", "intent", "attempt", "flow"],
  broad: ["monitoring", "escalation", "escalate", "safety", "review", "documents", "guidelines"],
};

function scoreChunk(query: string, chunk: SearchResult) {
  const haystack = `${chunk.title} ${chunk.section_heading ?? ""} ${chunk.content}`.toLowerCase();
  const lowered = query.toLowerCase();
  const keywordScore = Object.values(queryTerms)
    .flat()
    .reduce((score, term) => score + (lowered.includes(term) && haystack.includes(term) ? 0.12 : 0), 0);
  const tokenScore = lowered
    .split(/\W+/)
    .filter((token) => token.length > 3)
    .reduce((score, token) => score + (haystack.includes(token) ? 0.06 : 0), 0);
  return Math.min(0.98, chunk.similarity * 0.6 + keywordScore + tokenScore);
}

export function demoSearch(query: string, topK = 8, documentId?: string, documentIds?: string[]) {
  const filters = documentIds?.length ? documentIds : documentId ? [documentId] : null;
  return demoChunks
    .filter((chunk) => !filters || filters.includes(chunk.document_id))
    .map((chunk) => {
      const similarity = scoreChunk(query, chunk);
      return { ...chunk, similarity, source_strength: sourceStrengthForSimilarity(similarity) };
    })
    .filter((chunk) => chunk.similarity > 0.45)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

export function demoAnswer(query: string, documentId?: string, documentIds?: string[]): RagAnswer {
  const lowered = query.toLowerCase();
  const mentionsLithium = lowered.includes("lithium") || lowered.includes("toxicity");
  const mentionsClozapine = lowered.includes("clozapine") || lowered.includes("table") || lowered.includes("image");
  // The bare word "risk" is far too common to anchor a confident acute-risk
  // answer (e.g. "bleeding risk with aspirin"); require genuine escalation/triage
  // context so an incidental mention doesn't trigger a wrong-topic answer.
  const mentionsAcuteRisk =
    lowered.includes("escalat") ||
    lowered.includes("senior") ||
    lowered.includes("triage") ||
    /\bacute risk\b/.test(lowered) ||
    lowered.includes("means restriction") ||
    lowered.includes("safety plan");
  const broadMultiDocumentQuery =
    lowered.includes("across") ||
    lowered.includes("multiple") ||
    lowered.includes("documents") ||
    (lowered.includes("monitoring") && (lowered.includes("escalat") || lowered.includes("safety")));
  const inferredDocumentId =
    broadMultiDocumentQuery || documentIds?.length
      ? undefined
      : (documentId ??
        (mentionsClozapine
          ? demoDocuments[1].id
          : mentionsAcuteRisk
            ? demoDocuments[2].id
            : mentionsLithium
              ? demoDocuments[0].id
              : undefined));
  const sources = demoSearch(query, 6, inferredDocumentId, documentIds);
  const quoteCards = extractQuoteCards(sources, query);
  const documentBreakdown = buildDocumentBreakdown(sources, quoteCards);
  const smartPanel = buildSmartPanel(query, sources);
  const evidenceSummary = buildEvidenceSummary(sources, quoteCards);
  const sourceCoverage = buildSourceCoverage(sources);
  const conflictsOrGaps = detectConflictsOrGaps(sources);
  const visualEvidence = buildVisualEvidence(sources);
  const bestSource = selectBestSourceRecommendation(sources, quoteCards);
  const supportedQuestion = broadMultiDocumentQuery || mentionsLithium || mentionsClozapine || mentionsAcuteRisk;
  let answer =
    "These synthetic demo documents do not contain enough matching evidence to answer that question. Try one of the sample lithium, clozapine, or acute risk questions.";

  if (broadMultiDocumentQuery) {
    answer =
      "Across the synthetic indexed documents, the high-yield clinical themes are medication monitoring and escalation triggers across Lithium, Clozapine, and acute risk workflows.";
  } else if (mentionsLithium) {
    answer =
      "In the synthetic lithium document, toxicity safety-net review should cover vomiting, diarrhoea, dehydration, acute kidney injury, new interacting medicines such as NSAIDs/ACE inhibitors/diuretics, tremor, confusion, and ataxia.";
  } else if (mentionsClozapine) {
    answer =
      "The synthetic clozapine table image highlights FBC/ANC, myocarditis, metabolic review, and constipation planning as the core monitoring domains.";
  } else if (mentionsAcuteRisk) {
    answer =
      "The synthetic acute risk document highlights immediate safety, current intent, means restriction, protective factors, and senior review as the core escalation focus.";
  }

  return {
    answer: `${answer}\n\nSynthetic demo only: this is not clinical guidance.`,
    grounded: supportedQuestion && sources.length > 0,
    confidence: supportedQuestion && sources.length > 0 ? "high" : "unsupported",
    citations: sources.slice(0, 4).map(citationFromResult),
    sources,
    answerSections: sources.length
      ? broadMultiDocumentQuery
        ? [
            {
              heading: "Lithium monitoring and safety-netting",
              body: "The lithium source supports baseline renal, thyroid, calcium, weight, blood pressure, interacting medicine checks, and escalation for vomiting, diarrhoea, dehydration, tremor, confusion, or ataxia.",
              citation_chunk_ids: sources
                .filter((source) => source.document_id === demoDocuments[0].id)
                .slice(0, 2)
                .map((source) => source.id),
            },
            {
              heading: "Clozapine monitoring and urgent review",
              body: "The clozapine sources support FBC/ANC, myocarditis, metabolic review, constipation planning, and urgent review for fever, chest pain, dyspnoea, tachycardia, seizures, marked sedation, or severe constipation.",
              citation_chunk_ids: sources
                .filter((source) => source.document_id === demoDocuments[1].id)
                .slice(0, 2)
                .map((source) => source.id),
            },
            {
              heading: "Acute risk escalation",
              body: "The acute risk source supports escalation for current intent, recent attempt, command hallucinations, severe agitation, intoxication with unsafe behaviour, inability to collaborate on safety planning, or absent supervision.",
              citation_chunk_ids: sources
                .filter((source) => source.document_id === demoDocuments[2].id)
                .slice(0, 2)
                .map((source) => source.id),
            },
          ]
        : [
            {
              heading: "Safety-net symptoms",
              body:
                lowered.includes("clozapine") || lowered.includes("table") || lowered.includes("image")
                  ? "Urgent review triggers include fever, chest pain, dyspnoea, tachycardia, marked sedation, seizures, or severe constipation."
                  : lowered.includes("risk") || lowered.includes("escalat") || lowered.includes("senior")
                    ? "Escalate when current intent, recent attempt, command hallucinations, severe agitation, intoxication with unsafe behaviour, inability to collaborate on safety planning, or absent supervision is present."
                    : "Lithium toxicity safety-netting should cover vomiting, diarrhoea, dehydration, acute kidney injury, interacting medicines, tremor, confusion, and ataxia.",
              kind:
                lowered.includes("risk") || lowered.includes("escalat") || lowered.includes("senior")
                  ? "escalation_risk"
                  : "monitoring_timing",
              supportLevel: "direct",
              citation_chunk_ids: sources.slice(0, 4).map((source) => source.id),
            },
            ...(lowered.includes("lithium") || lowered.includes("toxicity")
              ? [
                  {
                    heading: "Monitoring timing",
                    body: "The same synthetic source says lithium levels are checked 5 to 7 days after initiation or dose change, then repeated until stable.",
                    kind: "monitoring_timing" as const,
                    supportLevel: "direct" as const,
                    citation_chunk_ids: sources.slice(0, 2).map((source) => source.id),
                  },
                ]
              : []),
          ]
      : [],
    evidenceSummary,
    sourceCoverage,
    conflictsOrGaps,
    quoteCards,
    visualEvidence,
    bestSource,
    documentBreakdown,
    smartPanel: { ...smartPanel, bestSource },
  };
}

export function demoSummary(documentId: string): RagAnswer {
  const sources = demoSearch("", 6, documentId);
  const quoteCards = extractQuoteCards(sources, "summary");
  const documentBreakdown: DocumentBreakdown[] = buildDocumentBreakdown(sources, quoteCards);
  const smartPanel: SmartPanel = {
    ...buildSmartPanel("summary", sources),
    documents: documentBreakdown,
    quotes: quoteCards,
    bestSource: selectBestSourceRecommendation(sources, quoteCards),
  };
  const document = getDemoDocument(documentId);
  const answer =
    document?.id === demoDocuments[0].id
      ? "Synthetic lithium summary: confirm baseline renal, thyroid, calcium, weight, blood pressure, interacting medicines, mood/risk context, monitoring owner, and review interval. Safety-net symptoms include vomiting, diarrhoea, dehydration, tremor, confusion, and ataxia."
      : document?.id === demoDocuments[1].id
        ? "Synthetic clozapine summary: monitor FBC/ANC, myocarditis symptoms, metabolic parameters, constipation, and shared-care communication. The image evidence shows a table of monitoring domains across baseline, initiation, and ongoing care."
        : "Synthetic acute risk summary: assess immediate safety, current intent, means restriction, protective factors, and senior review needs. Escalation triggers include current intent, recent attempt, command hallucinations, severe agitation, intoxication with unsafe behaviour, inability to collaborate, or absent supervision.";

  return {
    answer: `${answer}\n\nSynthetic demo only: this is not clinical guidance.`,
    grounded: true,
    confidence: "high",
    citations: sources.slice(0, 4).map(citationFromResult),
    sources,
    answerSections: [
      {
        heading:
          document?.id === demoDocuments[0].id
            ? "Lithium monitoring focus"
            : document?.id === demoDocuments[1].id
              ? "Clozapine monitoring focus"
              : "Acute risk focus",
        body:
          document?.id === demoDocuments[0].id
            ? "Confirm baseline renal, thyroid, calcium, weight, blood pressure, interacting medicines, mood/risk context, monitoring owner, and review interval."
            : document?.id === demoDocuments[1].id
              ? "Monitor FBC/ANC, myocarditis symptoms, metabolic parameters, constipation, and shared-care communication."
              : "Assess immediate safety, current intent, means restriction, protective factors, and senior review needs.",
        kind: document?.id === demoDocuments[2].id ? "escalation_risk" : "monitoring_timing",
        supportLevel: "direct",
        citation_chunk_ids: sources.slice(0, 4).map((source) => source.id),
      },
    ],
    evidenceSummary: buildEvidenceSummary(sources, quoteCards),
    sourceCoverage: buildSourceCoverage(sources),
    conflictsOrGaps: detectConflictsOrGaps(sources),
    quoteCards,
    visualEvidence: buildVisualEvidence(sources),
    bestSource: smartPanel.bestSource,
    documentBreakdown,
    smartPanel,
  };
}

export function getDemoImage(id: string) {
  return demoImages.find((image) => image.id === id) ?? null;
}
