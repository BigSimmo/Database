import { canAccessFavouritesMode } from "@/lib/app-modes";
import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";

// Canonical Tools dataset. Previously duplicated between the live launcher
// (applications-launcher-page.tsx inline array) and the mockup fixtures
// (tools-page-mockups/tool-fixtures.ts) with divergent fields and two separate filter
// implementations. Icons are UI concerns and stay in the components (keyed by id).

export type ToolCatalogStatus = "ready" | "recent" | "review_due";
export type ToolCatalogArea = "assessment" | "reference" | "care" | "coordination" | "saved";

export type ToolCatalogRecord = {
  id: string;
  title: string;
  mobileTitle?: string;
  description: string;
  bestFor: string;
  detail: string;
  href: string;
  external?: boolean;
  area: ToolCatalogArea;
  status: ToolCatalogStatus;
  sourceBacked: boolean;
  safetyFirst?: boolean;
  highYield?: boolean;
  actionLabel: string;
  keywords: string[];
  checkFirst: string[];
  neededInput: string[];
  output: string;
};

export const toolCatalogRecords: ToolCatalogRecord[] = [
  {
    id: "clinical-kb-search",
    title: "Clinical KB Search",
    mobileTitle: "Clinical KB",
    description: "Ask source-backed clinical questions and move straight to evidence.",
    bestFor: "Quick answers and guidance",
    detail: "Ask source-backed clinical questions and move straight to evidence.",
    href: "/?mode=answer",
    area: "assessment",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Ask",
    keywords: ["answer", "ask", "source", "knowledge base", "clinical question", "search"],
    checkFirst: ["Clinical question or PICO", "Patient context and setting", "Timeframe or guideline scope"],
    neededInput: ["Clinical question", "Relevant patient context", "Optional source or document scope"],
    output: "Concise answer, key points, citations, and source links.",
  },
  {
    id: "differentials",
    title: "Differentials",
    description: "Build and compare diagnostic possibilities with source-aware prompts.",
    bestFor: "Broad or complex presentations",
    detail: "Compare diagnostic possibilities, supporting features, red flags, and next-step questions.",
    href: "/differentials",
    area: "assessment",
    status: "recent",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Compare",
    keywords: ["compare", "diagnosis", "differential", "presentation", "risk"],
    checkFirst: ["Red flags", "Key presenting features", "Important negatives"],
    neededInput: ["Chief concern", "History and examination features", "Available observations or tests"],
    output: "Ranked differentials, rationale, must-not-miss risks, and next steps.",
  },
  {
    id: "documents",
    title: "Documents",
    mobileTitle: "Docs",
    description: "Search indexed PDFs, policies, guidelines, pages, tables, and images.",
    bestFor: "Trusted documents and pages",
    detail: "Find the source document, page, table, image, or policy wording behind an answer.",
    href: "/?mode=documents",
    area: "reference",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Search",
    keywords: ["documents", "docs", "pdf", "policy", "guideline", "source", "pages"],
    checkFirst: ["Document title or topic", "Local policy scope", "Page, table, or image need"],
    neededInput: ["Source topic", "Optional document name", "Preferred date or local scope"],
    output: "Matching documents, page context, snippets, and source links.",
  },
  {
    id: "guidelines",
    title: "Guidelines",
    description: "Browse trusted guidelines and clinical pathways.",
    bestFor: "Recommendations and standards",
    detail: "Move from a clinical question to guideline wording, pathway steps, and source context.",
    href: "/?mode=documents&q=guideline&focus=1",
    area: "reference",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Browse",
    keywords: ["guidelines", "recommendations", "standards", "pathways"],
    checkFirst: ["Guideline topic", "Population or setting", "Local policy relevance"],
    neededInput: ["Condition or intervention", "Clinical setting", "Optional source preference"],
    output: "Guideline matches, key recommendations, and linked source context.",
  },
  {
    id: "risk-safety",
    title: "Risk & Safety",
    mobileTitle: "Safety",
    description: "Check risks, contraindications, alerts, and safety guidance.",
    bestFor: "Preventing harm",
    detail: "Check risks, contraindications, and safety alerts before making clinical decisions.",
    href: "/?mode=answer&q=safety%20check&focus=1",
    area: "care",
    status: "review_due",
    sourceBacked: true,
    safetyFirst: true,
    actionLabel: "Open",
    keywords: ["risk", "safety", "contraindications", "red flags", "alerts", "harm"],
    checkFirst: [
      "Allergies and adverse reactions",
      "Drug-drug and drug-disease interactions",
      "Dose adjustments and monitoring needs",
      "Safety alerts and warnings",
    ],
    neededInput: [
      "Patient context and problem list",
      "Current medications and doses",
      "Allergies and prior reactions",
      "Renal/hepatic function if relevant",
    ],
    output: "Prioritized risks, alerts, and actionable recommendations with source links.",
  },
  {
    id: "medication-prescribing",
    title: "Medication Prescribing",
    mobileTitle: "Prescribe",
    description: "Review prescribing context, monitoring, interactions, and cautions.",
    bestFor: "Safe and effective prescribing",
    detail: "Review medication context, dosing, interactions, monitoring, and medication-specific cautions.",
    href: "/?mode=prescribing",
    area: "care",
    status: "review_due",
    sourceBacked: true,
    safetyFirst: true,
    actionLabel: "Prescribe",
    keywords: ["medication", "medications", "prescribing", "dose", "monitoring", "interactions"],
    checkFirst: ["Current medicines", "Contraindications", "Monitoring requirements"],
    neededInput: ["Medicine and indication", "Dose and route if known", "Comorbidities and key labs"],
    output: "Prescribing guidance, monitoring plan, cautions, and references.",
  },
  {
    id: "services",
    title: "Services",
    description: "Open source-backed service records, referral routes, and eligibility.",
    bestFor: "Referrals and coordination",
    detail: "Open service records with referral routes, eligibility, source status, and access pathways.",
    href: "/services",
    area: "coordination",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Refer",
    keywords: ["services", "referral", "eligibility", "pathway", "contact"],
    checkFirst: ["Eligibility", "Referral route", "Service source status"],
    neededInput: ["Patient location or catchment", "Clinical need", "Urgency and pathway requirements"],
    output: "Referral pathway, eligibility notes, service record, and source link.",
  },
  {
    id: "forms",
    title: "Forms",
    description: "Find clinical forms and source-backed readiness pathways.",
    bestFor: "Forms and workflows",
    detail: "Open form search, readiness checks, pathway tasks, and source-backed records.",
    href: "/forms",
    area: "coordination",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Open",
    keywords: ["forms", "paperwork", "readiness", "pathway"],
    checkFirst: ["Current form version", "Required fields", "Linked service pathway"],
    neededInput: ["Form type", "Clinical pathway", "Patient or service context"],
    output: "Relevant form, readiness tasks, and source-backed pathway details.",
  },
  {
    id: "care-plans",
    title: "Care plans",
    description: "Create and review management plans with monitoring and follow-up.",
    bestFor: "Ongoing care planning",
    detail: "Structure care planning, review milestones, monitoring needs, and follow-up tasks.",
    href: "/?mode=answer&q=care%20plan&focus=1",
    area: "care",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Open",
    keywords: ["care plan", "management", "follow-up", "monitoring"],
    checkFirst: ["Goals of care", "Review date", "Monitoring responsibilities"],
    neededInput: ["Diagnosis or working problem", "Current plan", "Follow-up timeframe"],
    output: "Care-plan structure, review points, and monitoring prompts.",
  },
  {
    id: "safety-plan",
    title: "Safety plan",
    mobileTitle: "Safety plan",
    description: "Build a patient safety plan with the Stanley-Brown six steps and a printable copy.",
    bestFor: "Collaborative safety planning",
    detail:
      "Build an evidence-based safety plan with the patient — warning signs, coping strategies, supports, and means safety — with a live patient copy to print, save as PDF, or hand over.",
    href: "/safety-plan",
    area: "care",
    status: "ready",
    sourceBacked: false,
    safetyFirst: true,
    actionLabel: "Open",
    keywords: [
      "safety plan",
      "safety planning",
      "crisis",
      "crisis plan",
      "stanley brown",
      "coping",
      "warning signs",
      "suicide",
      "means safety",
    ],
    checkFirst: ["Current risk and recent changes", "Warning signs and triggers", "Trusted supports and crisis lines"],
    neededInput: ["Warning signs", "Coping strategies and supports", "Crisis contacts and means-safety steps"],
    output: "A six-step safety plan with a patient copy to print, save as PDF, or hand over.",
  },
  {
    id: "monitoring",
    title: "Monitoring",
    description: "Track and review key monitoring parameters and results.",
    bestFor: "Ongoing monitoring",
    detail: "Review monitoring intervals, parameters, alerts, and follow-up actions.",
    href: "/?mode=answer&q=monitoring%20schedule&focus=1",
    area: "care",
    status: "ready",
    sourceBacked: true,
    highYield: true,
    actionLabel: "Open",
    keywords: ["monitoring", "results", "parameters", "schedule", "labs"],
    checkFirst: ["Monitoring indication", "Last result date", "Thresholds and alerts"],
    neededInput: ["Medication or condition", "Recent results", "Monitoring timeframe"],
    output: "Monitoring schedule, thresholds, and review prompts.",
  },
  {
    id: "favourites",
    title: "Saved workflows",
    mobileTitle: "Saved",
    description: "Return to saved clinical workspaces and repeated workflows.",
    bestFor: "Repeated or complex work",
    detail: "Resume saved answers, pinned sources, and repeated clinical workflows.",
    href: "/favourites",
    area: "saved",
    status: "recent",
    sourceBacked: false,
    actionLabel: "View",
    keywords: ["favourites", "favorites", "saved", "recent", "pinned"],
    checkFirst: ["Saved context", "Last-used status", "Review markers"],
    neededInput: ["Saved item or workflow name", "Optional source set", "Review context"],
    output: "Saved workspace, pinned source, or recent workflow.",
  },
];

export function toolCatalogRecordById(id: string) {
  return toolCatalogRecords.find((tool) => tool.id === id) ?? toolCatalogRecords[0];
}

/** Hide account-scoped Favourites / Saved workflows from guest Tools surfaces. */
export function toolCatalogRecordsForSession(options: { authenticated: boolean; demoMode: boolean }) {
  if (canAccessFavouritesMode(options)) return toolCatalogRecords;
  return toolCatalogRecords.filter((tool) => tool.id !== "favourites" && !tool.href.startsWith("/favourites"));
}

export function toolSearchText(tool: ToolCatalogRecord) {
  return normalizeSearchText(
    [
      tool.title,
      tool.mobileTitle,
      tool.description,
      tool.bestFor,
      tool.detail,
      tool.area,
      ...tool.keywords,
      ...tool.checkFirst,
      tool.output,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" "),
  );
}

export type ToolSearchMatch = { tool: ToolCatalogRecord; score: number; reasons: string[] };

export function rankToolRecords(
  query: string,
  limit?: number,
  // Low-weight synonym/acronym/alias terms (see rankMedicationRecords) for the expanded lane.
  expansions: string[] = [],
  /**
   * Session access for Favourites / Saved workflows. Defaults fail closed so callers
   * that omit session never leak account-scoped Tools entries to guests.
   */
  session: { authenticated: boolean; demoMode: boolean } = { authenticated: false, demoMode: false },
): ToolSearchMatch[] {
  const records = toolCatalogRecordsForSession(session);
  return rankCatalogRecords(records, query, {
    fields: [
      {
        id: "title",
        weight: 6,
        text: (tool) => normalizeSearchText(`${tool.title} ${tool.mobileTitle ?? ""} ${tool.id}`),
      },
      { id: "keywords", weight: 3, text: (tool) => normalizeSearchText(tool.keywords.join(" ")) },
    ],
    fullText: toolSearchText,
    contentWeight: 2,
    phraseBonus: 4,
    expandTokens: expansions.length ? (terms) => [...terms, ...expansions] : undefined,
    limit,
    tieBreak: (left, right) => left.title.localeCompare(right.title),
  }).map(({ record, score, signals }) => ({
    tool: record,
    score,
    reasons: [
      signals.fields.title ? "title" : "",
      signals.fields.keywords ? "keywords" : "",
      signals.content ? "description" : "",
    ].filter(Boolean),
  }));
}
