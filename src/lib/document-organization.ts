import { smartDocumentTitle } from "@/lib/document-naming";
import type {
  DocumentLabelType,
  DocumentOrganizationProfile,
  DocumentOrganizationSiteKind,
  DocumentOrganizationType,
} from "@/lib/types";

export type OrganizationDocumentInput = {
  title: string;
  file_name: string;
  source_path?: string | null;
  metadata?: unknown;
  contentText?: string | null;
  summaryText?: string | null;
};

export type OrganizationGeneratedLabel = {
  label: string;
  label_type: DocumentLabelType;
  confidence: number;
};

type SiteDefinition = {
  canonical: string;
  rawTags: string[];
  kind: DocumentOrganizationSiteKind;
  evidence: RegExp[];
};

type SecondaryFacet = {
  label: string;
  label_type: Extract<DocumentLabelType, "population" | "setting" | "service" | "topic" | "workflow" | "medication" | "risk">;
};

const organizationProfileVersion = "document-organization-v1";

const siteDefinitions: SiteDefinition[] = [
  // ── Individual hospitals ──────────────────────────────────────────────────
  // Royal Perth Bentley Group — 688 docs
  {
    canonical: "Royal Perth Bentley Group",
    rawTags: ["rpbg"],
    kind: "hospital",
    evidence: [/\broyal perth bentley\b/i, /\brpbg\b/i, /\broyal perth hospital\b/i, /\brph\b/i],
  },
  // Armadale Kalamunda Group — 197 docs
  {
    canonical: "Armadale Kalamunda Group",
    rawTags: ["akg"],
    kind: "hospital",
    evidence: [/\barmadale kalamunda\b/i, /\barmadale hospital\b/i, /\bakg\b/i],
  },
  // Fiona Stanley Hospital (incl. Fremantle Hospital / FSFHG group) — 340 docs
  {
    canonical: "Fiona Stanley Hospital",
    rawTags: ["fsh"],
    kind: "hospital",
    evidence: [/\bfiona stanley\b/i, /\bfsh\b/i, /\bfsfhg\b/i],
  },
  // Fremantle Hospital (legacy tag — now part of FSH group)
  {
    canonical: "Fremantle Hospital",
    rawTags: ["fh", "freo"],
    kind: "hospital",
    evidence: [/\bfremantle hospital\b/i, /\bfremantle health\b/i],
  },
  // Peel Health Campus — 156 docs
  {
    canonical: "Peel Health Campus",
    rawTags: ["phc"],
    kind: "hospital",
    evidence: [/\bpeel health campus\b/i, /\bpeel hospital\b/i, /\bphc\b/i],
  },
  // Bentley Health Service (subsidiary of RPBG)
  {
    canonical: "Bentley Health Service",
    rawTags: ["bhs"],
    kind: "hospital",
    evidence: [/\bbentley health service\b/i, /\bbhs\b/i],
  },
  // King Edward Memorial Hospital — 26 docs
  {
    canonical: "King Edward Memorial Hospital",
    rawTags: ["kemh"],
    kind: "hospital",
    evidence: [/\bking edward memorial\b/i, /\bkemh\b/i],
  },
  // Sir Charles Gairdner Hospital
  {
    canonical: "Sir Charles Gairdner Hospital",
    rawTags: ["scgh"],
    kind: "hospital",
    evidence: [/\bsir charles gairdner\b/i, /\bscgh\b/i],
  },
  // Perth Children's Hospital
  {
    canonical: "Perth Children's Hospital",
    rawTags: ["pch"],
    kind: "hospital",
    evidence: [/\bperth children['']?s hospital\b/i, /\bpch\b/i],
  },
  // Joondalup Health Campus
  {
    canonical: "Joondalup Health Campus",
    rawTags: ["jhc", "joondalup"],
    kind: "hospital",
    evidence: [/\bjoondalup health campus\b/i, /\bjhc\b/i],
  },
  // Osborne Park Hospital
  {
    canonical: "Osborne Park Hospital",
    rawTags: ["oph", "osborne park"],
    kind: "hospital",
    evidence: [/\bosborne park hospital\b/i, /\boph\b/i],
  },
  // Rockingham General Hospital
  {
    canonical: "Rockingham General Hospital",
    rawTags: ["rgh"],
    kind: "hospital",
    evidence: [/\brockingham general hospital\b/i, /\brgh\b/i],
  },
  // Graylands / Neuropsychiatric Campus
  {
    canonical: "Graylands / Neuropsychiatric",
    rawTags: ["graylands", "npscu"],
    kind: "hospital",
    evidence: [/\bgraylands\b/i, /\bneuropsychiatric\b/i, /\bnpscu\b/i],
  },

  // ── Health service networks ───────────────────────────────────────────────
  // East Metropolitan Health Service — 65 docs at network level
  {
    canonical: "East Metropolitan Health Service",
    rawTags: ["emhs", "emhs policy"],
    kind: "health_service",
    evidence: [/\beast metropolitan health service\b/i, /\bemhs\b/i],
  },
  // South Metropolitan Health Service (parent of FSH, FH, CAMHS, RKPG)
  {
    canonical: "South Metropolitan Health Service",
    rawTags: ["smhs", "smhs policy"],
    kind: "health_service",
    evidence: [/\bsouth metropolitan health service\b/i, /\bsmhs\b/i],
  },
  // North Metropolitan Health Service — 262 docs
  {
    canonical: "North Metropolitan Health Service",
    rawTags: ["nmhs", "nmhs policy"],
    kind: "health_service",
    evidence: [/\bnorth metropolitan health service\b/i, /\bnmhs\b/i],
  },
  // Rockingham Peel Group — 168 docs
  {
    canonical: "Rockingham Peel Group",
    rawTags: ["rkpg", "rockingham peel group"],
    kind: "health_service",
    evidence: [/\brockingham peel\b/i, /\brkpg\b/i],
  },
  // Child and Adolescent Health Service
  {
    canonical: "Child and Adolescent Health Service",
    rawTags: ["cahs"],
    kind: "health_service",
    evidence: [/\bchild and adolescent health service\b/i, /\bcahs\b/i],
  },
  // WA Country Health Service
  {
    canonical: "WA Country Health Service",
    rawTags: ["wachs"],
    kind: "health_service",
    evidence: [/\bwa country health service\b/i, /\bwachs\b/i],
  },
  // Bunbury Hospital / Bunbury Health Campus
  {
    canonical: "Bunbury Hospital",
    rawTags: ["bunbury", "bhc"],
    kind: "hospital",
    evidence: [/\bbunbury\b/i, /\bbhc\b/i],
  },
  // Geraldton Hospital / Geraldton Health Campus
  {
    canonical: "Geraldton Hospital",
    rawTags: ["geraldton", "ghc"],
    kind: "hospital",
    evidence: [/\bgeraldton\b/i, /\bghc\b/i],
  },
  // Albany Hospital / Albany Health Campus
  {
    canonical: "Albany Hospital",
    rawTags: ["albany", "ahc"],
    kind: "hospital",
    evidence: [/\balbany\b/i, /\bahc\b/i],
  },
  // Kalgoorlie Hospital / Kalgoorlie Health Campus
  {
    canonical: "Kalgoorlie Hospital",
    rawTags: ["kalgoorlie", "khc"],
    kind: "hospital",
    evidence: [/\bkalgoorlie\b/i, /\bkhc\b/i],
  },
  // WA Health / Department of Health
  {
    canonical: "WA Health",
    rawTags: ["wah", "wa health", "doh"],
    kind: "health_service",
    evidence: [/\bwa health\b/i, /\bdepartment of health\b/i, /\bdoh\b/i],
  },

  // ── Specialty programs / services ─────────────────────────────────────────
  // Child and Adolescent Mental Health Service — 83 docs
  {
    canonical: "Child and Adolescent Mental Health Service",
    rawTags: ["camhs"],
    kind: "program",
    evidence: [/\bchild and adolescent mental health\b/i, /\bcamhs\b/i],
  },
  // Mental Health Hospital in the Home — 3 docs
  {
    canonical: "Mental Health Hospital in the Home",
    rawTags: ["mhhith"],
    kind: "program",
    evidence: [/\bmental health hospital in the home\b/i, /\bmhhith\b/i],
  },
  // Peel Mental Health Service — 1 doc
  {
    canonical: "Peel Mental Health Service",
    rawTags: ["pmhs"],
    kind: "program",
    evidence: [/\bpeel mental health service\b/i, /\bpmhs\b/i],
  },
  // Mental Health Commission
  {
    canonical: "Mental Health Commission",
    rawTags: ["mhc"],
    kind: "program",
    evidence: [/\bmental health commission\b/i, /\bmhc\b/i],
  },
];

const secondaryTagMap = new Map<string, SecondaryFacet>([
  // Populations (Ages)
  ["adult", { label: "adult", label_type: "population" }],
  ["adults", { label: "adult", label_type: "population" }],
  ["child", { label: "paediatric", label_type: "population" }],
  ["children", { label: "paediatric", label_type: "population" }],
  ["paediatric", { label: "paediatric", label_type: "population" }],
  ["pediatric", { label: "paediatric", label_type: "population" }],
  ["neonatal", { label: "neonatal", label_type: "population" }],
  ["neonate", { label: "neonatal", label_type: "population" }],
  ["newborn", { label: "neonatal", label_type: "population" }],
  ["youth", { label: "youth", label_type: "population" }],
  ["adolescent", { label: "youth", label_type: "population" }],
  ["teen", { label: "youth", label_type: "population" }],
  ["geriatric", { label: "geriatric", label_type: "population" }],
  ["older adult", { label: "geriatric", label_type: "population" }],
  ["elderly", { label: "geriatric", label_type: "population" }],

  // Clinical / Administrative Split
  ["clinical", { label: "clinical", label_type: "workflow" }],
  ["non-clinical", { label: "non-clinical", label_type: "workflow" }],
  ["non clinical", { label: "non-clinical", label_type: "workflow" }],
  ["admin", { label: "admin", label_type: "workflow" }],
  ["clerical", { label: "admin", label_type: "workflow" }],
  ["finance", { label: "finance", label_type: "workflow" }],
  ["financial", { label: "finance", label_type: "workflow" }],
  ["hr", { label: "hr", label_type: "workflow" }],
  ["human resources", { label: "hr", label_type: "workflow" }],

  // Topics / Services
  ["ect", { label: "electroconvulsive therapy", label_type: "topic" }],
  ["pats", { label: "patient assisted travel scheme", label_type: "workflow" }],
  ["ppm", { label: "permanent pacemaker", label_type: "topic" }],
  ["cpop", { label: "community program for opioid pharmacotherapy", label_type: "workflow" }],
  ["kara maar", { label: "kara maar", label_type: "service" }],
  ["mother baby unit", { label: "mother baby unit", label_type: "service" }],
  ["cockburn health", { label: "cockburn health", label_type: "service" }],
  ["psychology and neuropsychology", { label: "psychology and neuropsychology", label_type: "service" }],
]);

const documentTypePatterns: Array<{
  label: DocumentOrganizationType;
  confidence: number;
  patterns: RegExp[];
}> = [
  { label: "policy", confidence: 0.9, patterns: [/\bpolicy\b/i] },
  { label: "procedure", confidence: 0.88, patterns: [/\bprocedure\b/i, /\bprocedural\b/i, /\bsop\b/i] },
  { label: "guideline", confidence: 0.84, patterns: [/\bguideline\b/i, /\bguidance\b/i] },
  { label: "protocol", confidence: 0.84, patterns: [/\bprotocol\b/i] },
  { label: "form", confidence: 0.82, patterns: [/\bform\b/i, /\brequest\b/i, /\breferral\b/i] },
  { label: "checklist", confidence: 0.82, patterns: [/\bchecklist\b/i] },
  { label: "pathway", confidence: 0.82, patterns: [/\bpathway\b/i] },
  { label: "algorithm", confidence: 0.84, patterns: [/\balgorithm\b/i, /\bflowchart\b/i, /\bdecision tree\b/i] },
  {
    label: "factsheet",
    confidence: 0.82,
    patterns: [
      /\bfactsheet\b/i,
      /\bfact\s*sheet\b/i,
      /\bpatient information\b/i,
      /\bpatient info\b/i,
      /\bconsumer info\b/i,
    ],
  },
  { label: "manual", confidence: 0.82, patterns: [/\bmanual\b/i, /\bhandbook\b/i, /\borientation\b/i] },
  {
    label: "assessment_tool",
    confidence: 0.82,
    patterns: [/\btool\b/i, /\bscale\b/i, /\bscore\b/i, /\bassessment\b/i],
  },
  {
    label: "prescribing_aid",
    confidence: 0.82,
    patterns: [/\bprescrib\b/i, /\baid\b/i, /\bcalculator\b/i, /\bdosing\b/i, /\bnomogram\b/i],
  },
  { label: "reference", confidence: 0.72, patterns: [/\breference\b/i, /\binformation sheet\b/i, /\bplacecard\b/i] },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metadataString(metadata: unknown, key: string) {
  const value = metadataRecord(metadata)[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function extractDocumentBracketTags(...values: Array<string | null | undefined>) {
  const tags: string[] = [];
  const bracketPattern = /[\[(]([^\])()]{2,80})[\])]/g;

  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(bracketPattern)) {
      const tag = match[1]
        .replace(/\s+/g, " ")
        .replace(/\s+-\s+/g, "-")
        .trim();
      if (!tag || /\b(?:copy|duplicate|page)\b/i.test(tag)) continue;
      tags.push(tag);
    }
  }

  return uniqueStrings(tags);
}

function siteDefinitionForTag(tag: string) {
  const normalized = normalizeText(tag);
  return siteDefinitions.find((definition) =>
    definition.rawTags.some((rawTag) => normalizeText(rawTag) === normalized),
  );
}

function bracketTagsForRemoval(tags: string[]) {
  return new Set(
    tags.filter((tag) => siteDefinitionForTag(tag) || secondaryTagMap.has(normalizeText(tag))).map(normalizeText),
  );
}

export function canonicalDocumentDisplayTitle(input: Pick<OrganizationDocumentInput, "title" | "file_name">) {
  const rawTags = extractDocumentBracketTags(input.title, input.file_name);
  const removable = bracketTagsForRemoval(rawTags);
  const source = input.title?.trim() || input.file_name;
  const withoutExtension = source.replace(/\.[A-Za-z0-9]{1,12}$/, "");
  const cleaned = withoutExtension
    .replace(/[\[(]([^\])()]{2,80})[\])]/g, (match, rawTag: string) =>
      removable.has(normalizeText(rawTag)) ? " " : match,
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;])/g, "$1")
    .trim();

  return smartDocumentTitle(cleaned || input.title || input.file_name).replace(/\b([A-Z]{2,}) - ([A-Z])\b/g, "$1-$2");
}

function evidenceText(input: OrganizationDocumentInput) {
  const metadata = metadataRecord(input.metadata);
  return [
    input.source_path ?? "",
    input.contentText ?? "",
    input.summaryText ?? "",
    metadataString(metadata, "publisher"),
    metadataString(metadata, "jurisdiction"),
    metadataString(metadata, "source_title"),
  ]
    .join(" ")
    .slice(0, 100_000);
}

function siteEvidence(definition: SiteDefinition, input: OrganizationDocumentInput) {
  const evidence = [`bracket:${definition.rawTags[0].toUpperCase()}`];
  const haystack = evidenceText(input);
  for (const pattern of definition.evidence) {
    if (pattern.test(haystack)) {
      evidence.push(`source:${pattern.source.replaceAll("\\b", "").slice(0, 40)}`);
      break;
    }
  }
  return evidence;
}

function classifySite(input: OrganizationDocumentInput, rawTags: string[]) {
  const candidates = rawTags
    .map((tag) => ({ tag, definition: siteDefinitionForTag(tag) }))
    .filter((item): item is { tag: string; definition: SiteDefinition } => Boolean(item.definition))
    .map(({ tag, definition }) => {
      const evidence_sources = siteEvidence(definition, input);
      const confirmed = evidence_sources.some((source) => source.startsWith("source:"));
      return {
        label: definition.canonical,
        raw_tag: tag,
        kind: definition.kind,
        confidence: confirmed ? 0.92 : 0.58,
        evidence_sources: [`bracket:${tag}`, ...evidence_sources.filter((source) => source.startsWith("source:"))],
      };
    });

  const confirmedCandidates = candidates.filter((candidate) => candidate.confidence >= 0.75);
  const selected = confirmedCandidates.length === 1 ? confirmedCandidates[0] : null;

  return {
    label: selected?.label ?? null,
    raw_tag: selected?.raw_tag ?? null,
    kind: selected?.kind ?? ("unknown" as const),
    confidence:
      selected?.confidence ?? (candidates.length ? Math.max(...candidates.map((item) => item.confidence)) : 0),
    evidence_sources: selected?.evidence_sources ?? [],
    candidates,
  };
}

function classifyDocumentType(input: OrganizationDocumentInput): DocumentOrganizationProfile["document_type"] {
  const titleText = `${input.title} ${input.file_name}`;
  const matchedTitle = documentTypePatterns.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(titleText)),
  );
  if (matchedTitle) {
    return {
      label: matchedTitle.label,
      confidence: matchedTitle.confidence,
      evidence_sources: [`title_pattern:${matchedTitle.label}`],
    };
  }

  const metaText = `${metadataString(input.metadata, "source_type")} ${metadataString(input.metadata, "category")}`;
  const matchedMeta = documentTypePatterns.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(metaText)),
  );
  if (matchedMeta) {
    return {
      label: matchedMeta.label,
      confidence: Math.max(0.5, matchedMeta.confidence - 0.05),
      evidence_sources: [`metadata_pattern:${matchedMeta.label}`],
    };
  }

  const fullText = `${input.source_path ?? ""} ${input.summaryText ?? ""} ${input.contentText ?? ""}`;
  const matchedContent = documentTypePatterns.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(fullText)),
  );
  if (matchedContent) {
    return {
      label: matchedContent.label,
      confidence: Math.max(0.5, matchedContent.confidence - 0.15),
      evidence_sources: [`content_pattern:${matchedContent.label}`],
    };
  }

  return { label: "unknown", confidence: 0.2, evidence_sources: [] };
}

function emptySecondaryFacets(): DocumentOrganizationProfile["secondary_facets"] {
  return { population: [], setting: [], service: [], topic: [], workflow: [], medication: [], risk: [] };
}

function secondaryFacets(rawTags: string[], titleText: string, contentText: string) {
  const facets = emptySecondaryFacets();
  for (const rawTag of rawTags) {
    const facet = secondaryTagMap.get(normalizeText(rawTag));
    if (!facet) continue;
    facets[facet.label_type].push(facet.label);
  }

  const fullText = `${titleText} ${contentText}`.toLowerCase();

  // ── Population / Age cohorts ─────────────────────────────────────────────
  if (/\b(?:neonatal|neonate|newborn|baby|born|nicu)\b/.test(fullText)) facets.population.push("neonatal");
  if (/\b(?:paediatric|pediatric|child|children|pmh|pch)\b/.test(fullText)) facets.population.push("paediatric");
  if (/\b(?:youth|adolescent|teen|young person|young adult)\b/.test(fullText)) facets.population.push("youth");
  if (/\b(?:adult|adults)\b/.test(fullText)) facets.population.push("adult");
  if (/\b(?:geriatric|older adult|elderly|aged|65 years)\b/.test(fullText)) facets.population.push("geriatric");

  // ── Workflow / Admin split ───────────────────────────────────────────────
  if (/\b(?:clinical|medical|nursing|ward|midwife|physio|ot|treatment|prescrib|drug)\b/.test(fullText)) facets.workflow.push("clinical");
  if (/\b(?:admin|clerical|finance|billing|payroll|human resources|roster|audit|governance|non-clinical|non clinical)\b/.test(fullText)) facets.workflow.push("non-clinical");
  if (/\b(?:finance|financial|billing|funding|invoice|payment|cost|budget)\b/.test(fullText)) facets.workflow.push("finance");
  if (/\b(?:human resources|personnel|staffing|hiring|recruitment)\b/.test(fullText)) facets.workflow.push("hr");

  // ── Clinical Specialty (mapped to service) ────────────────────────────────
  if (/\b(?:emergency|ed\b|emergency department|trauma|resus|triage|mbcp|racpc)\b/.test(fullText)) facets.service.push("emergency-medicine");
  if (/\b(?:mental health|psychiatr|psychosis|schizophrenia|bipolar|ect\b|seclusion|detention|camhs|inpatient mental|community mental)\b/.test(fullText)) facets.service.push("mental-health");
  if (/\b(?:obstetric|maternity|labour|birth|antenatal|postnatal|perinatal|midwif|kemh|mbc\b|pregnancy|pregnant)\b/.test(fullText)) facets.service.push("obstetrics-maternity");
  if (/\b(?:neonatal|nicu|neonate|newborn|neonatal intensive)\b/.test(fullText)) facets.service.push("neonatology");
  if (/\b(?:icu\b|intensive care|critical care|hdu\b|high dependency|ventilat|vasoactive|inotrope|vasopressor)\b/.test(fullText)) facets.service.push("intensive-care");
  if (/\b(?:perioperative|anaesth|anaesthes|anesthes|theatre|operating|preoperative|post-?operative|surgical|intraoperative)\b/.test(fullText)) facets.service.push("perioperative-anaesthesia");
  if (/\b(?:pharmacy|pharmacist|drug guideline|iv drug|medication management|medicine management|pharmacol)\b/.test(fullText)) facets.service.push("pharmacy-medications");
  if (/\b(?:infection control|antimicrobial|antibiotic|cdiff|c. diff|mrsa|ipc\b|sterilisation|decontamination|isolation|sepsis|infectious disease)\b/.test(fullText)) facets.service.push("infectious-disease");
  if (/\b(?:oncolog|haematolog|hematolog|chemotherapy|transfusion|apheresis|hit\b|thrombocytopenia|blood product|leukaemia)\b/.test(fullText)) facets.service.push("oncology-haematology");
  if (/\b(?:cardiol|cardiac|heart failure|arrhythmia|ecg\b|pacemaker|vte\b|venous thromboembolism|atrial fibrillation|chest pain|coronary)\b/.test(fullText)) facets.service.push("cardiology");
  if (/\b(?:orthopaed|orthoped|fracture|bone|joint|spine|spinal|musculoskeletal|limb|ankle|hip replacement)\b/.test(fullText)) facets.service.push("orthopaedics");
  if (/\b(?:renal|nephrol|dialysis|haemodialysis|hemodialysis|kidney|glomerular|renal colic|renal failure)\b/.test(fullText)) facets.service.push("renal-nephrology");
  if (/\b(?:gastroenterol|endoscopy|colonoscopy|gastroscopy|bowel|liver|hepat|variceal|terlipressin|inflammatory bowel|ibd\b)\b/.test(fullText)) facets.service.push("gastroenterology");
  if (/\b(?:respiratory|pulmonol|lung|sleep apnoea|cpap\b|spirometry|bronch|asthma|copd\b|pleural|thoracic)\b/.test(fullText)) facets.service.push("respiratory");
  if (/\b(?:neurol|seizure|epilepsy|stroke|tia\b|ect\b|neuropsychol|parkinson|dementia|delirium)\b/.test(fullText)) facets.service.push("neurology");
  if (/\b(?:palliative|end of life|dying|comfort care|hospice|eol\b)\b/.test(fullText)) facets.service.push("palliative-care");
  if (/\b(?:dietetic|nutrition|nutritional|dietitian|enteral|parenteral|tube feed)\b/.test(fullText)) facets.service.push("allied-health");
  if (/\b(?:physiotherap|occupational therap|speech pathol|social work|allied health)\b/.test(fullText)) facets.service.push("allied-health");
  if (/\b(?:diabetes|endocrin|insulin|hypoglycaem|dka\b|diabetic ketoacidosis|hhs\b|hyperosmolar|thyroid|adrenal)\b/.test(fullText)) facets.service.push("diabetes-endocrinology");
  if (/\b(?:urology|urolog|catheter|urethral|bladder|prostate|renal calculus)\b/.test(fullText)) facets.service.push("urology");
  if (/\b(?:wound|wound care|wound management|pressure injury|ulcer|debridement|dressing)\b/.test(fullText)) facets.service.push("wound-management");
  if (/\b(?:pain management|pain relief|analges|analgesia|acute pain|chronic pain|opioid)\b/.test(fullText)) facets.service.push("pain-management");

  // ── Care Setting (mapped to setting) ─────────────────────────────────────
  if (/\b(?:emergency department|ed\b|emergency room|er\b|triage|trauma bay)\b/.test(fullText)) facets.setting.push("emergency-department");
  if (/\b(?:inpatient|ward|admitted|admission|bed management|inpatient unit)\b/.test(fullText)) facets.setting.push("inpatient");
  if (/\b(?:outpatient|ambulatory|clinic\b|day procedure|day surgery|day unit)\b/.test(fullText)) facets.setting.push("outpatient");
  if (/\b(?:icu\b|intensive care unit|critical care unit|hdu\b|high dependency)\b/.test(fullText)) facets.setting.push("icu-hdu");
  if (/\b(?:operating theatre|operating room|theatre suite|perioperative|post-?anaesth|pacu\b|recovery room)\b/.test(fullText)) facets.setting.push("operating-theatre");
  if (/\b(?:community|home visit|community health|outreach|community-based|cpop\b|community program)\b/.test(fullText)) facets.setting.push("community");
  if (/\b(?:maternity unit|birth suite|labour ward|antenatal ward|postnatal ward|birthing)\b/.test(fullText)) facets.setting.push("maternity-unit");
  if (/\b(?:mental health unit|psychiatric unit|mhu\b|acute mental health|psychiatric inpatient|seclusion)\b/.test(fullText)) facets.setting.push("mental-health-unit");

  // ── Medication Category (mapped to medication) ───────────────────────────
  if (/\b(?:anticoagul|heparin|warfarin|enoxaparin|dabigatran|rivaroxaban|apixaban|vte prophylaxis)\b/.test(fullText)) facets.medication.push("anticoagulants");
  if (/\b(?:opioid|morphine|fentanyl|oxycodone|hydromorphone|pethidine|codeine|naloxone|buprenorphine|methadone)\b/.test(fullText)) facets.medication.push("opioids");
  if (/\b(?:insulin|subcutaneous insulin|basal|bolus|sliding scale|dka|hyperglycaem)\b/.test(fullText)) facets.medication.push("insulin");
  if (/\b(?:antibiotic|antimicrobial|penicillin|cephalosporin|vancomycin|gentamicin|meropenem|flucloxacillin|minocycline|benzylpenicillin)\b/.test(fullText)) facets.medication.push("antimicrobials");
  if (/\b(?:antipsychotic|clozapine|olanzapine|quetiapine|risperidone|haloperidol|droperidol|lai\b|long-acting injectable|depot)\b/.test(fullText)) facets.medication.push("antipsychotics");
  if (/\b(?:blood product|packed red cells|ffp\b|fresh frozen plasma|platelet|transfusion|massive transfusion|blood bank)\b/.test(fullText)) facets.medication.push("blood-products");
  if (/\b(?:iv drug guideline|intravenous drug|iv administration|iv infusion|intravenous medication)\b/.test(fullText)) facets.medication.push("iv-medications");
  if (/\b(?:controlled drug|schedule 8|schedule 4|restricted medication|s8\b|s4\b|dangerous drug)\b/.test(fullText)) facets.medication.push("controlled-drugs");
  if (/\b(?:chemotherapy|cytotoxic|antineoplastic|anticancer|immunosuppressant)\b/.test(fullText)) facets.medication.push("chemotherapy");
  if (/\b(?:lithium|mood stabiliser|mood stabilizer|valproate|carbamazepine|lamotrigine)\b/.test(fullText)) facets.medication.push("mood-stabilisers");

  // ── Clinical Audience / Roles (mapped to workflow) ───────────────────────
  if (/\b(?:nurs(?:ing|e)|midwif(?:e|ery)|nursing care|nurse practitioner|clinical nurse|cns\b|cnc\b)\b/.test(fullText)) facets.workflow.push("nursing-midwifery");
  if (/\b(?:medical officer|doctor|prescrib(?:er|ing)|registrar|consultant|junior medical|jmo\b|clinician)\b/.test(fullText)) facets.workflow.push("medical-officer");
  if (/\b(?:dietetic|nutrition|social work|physiotherap|occupational therap|speech pathol|allied health)\b/.test(fullText)) facets.workflow.push("allied-health");
  if (/\b(?:patient information|leaflet|booklet|fact ?sheet|consent form|patient-facing|for patients|patient education)\b/.test(fullText)) facets.workflow.push("patient-facing");
  if (/\b(?:all staff|hospital-wide|global guideline|general policy|code black|code blue|evacuation)\b/.test(fullText)) facets.workflow.push("all-staff");
  if (/\b(?:pharmac(?:y|ist)|dispensing|medication storage|formulary checklist)\b/.test(fullText)) facets.workflow.push("pharmacy-staff");
  if (/\b(?:psycholog(?:ist|y)|mental health clinician|case manager|camhs staff|psychiatric nurse)\b/.test(fullText)) facets.workflow.push("mental-health-practitioners");
  if (/\b(?:clerical|ward clerk|medical records|scanning work|webpas user|receptionist|billing clerk)\b/.test(fullText)) facets.workflow.push("clerical-admin");
  if (/\b(?:security guard|orderly|patient transport|escort duty|facilities staff|orderlies)\b/.test(fullText)) facets.workflow.push("security-orderlies");
  if (/\b(?:student|intern|resident|placement guide|supervised practice|supervision protocol)\b/.test(fullText)) facets.workflow.push("students-supervisors");

  // ── Clinical Risk & Alerts (mapped to risk) ──────────────────────────────
  if (/\b(?:high risk medication|potassium|lithium|clozapine|insulin|high alert med|apheresis|heparin)\b/.test(fullText)) facets.risk.push("high-risk-medication");
  if (/\b(?:clinical alert|sepsis alert|deteriorating patient|resuscitation|cpr\b|cardiac arrest|met call|medical emergency)\b/.test(fullText)) facets.risk.push("clinical-alert");
  if (/\b(?:open disclosure|incident report|sentinel event|clinical governance|audit checklist|root cause)\b/.test(fullText)) facets.risk.push("open-disclosure");
  if (/\b(?:infection prevention|infection control|ipc\b|ppe\b|sterile procedure|isolation precaution|decontamination)\b/.test(fullText)) facets.risk.push("infection-prevention");
  if (/\b(?:clinical handover|handover|isbar\b|patient transfer|escalation protocol|deteriorat)\b/.test(fullText)) facets.risk.push("clinical-handover-escalation");
  if (/\b(?:falls prevention|fall risk|post fall|bed alarm|falls assessment)\b/.test(fullText)) facets.risk.push("falls-prevention");
  if (/\b(?:restrictive practice|restraint|chemical restraint|physical restraint|seclusion)\b/.test(fullText)) facets.risk.push("restrictive-practices");
  if (/\b(?:blood safety|blood product|transfusion|massive transfusion|mtp\b|packed red cell|plasma transfusion)\b/.test(fullText)) facets.risk.push("blood-safety-transfusion");
  if (/\b(?:pressure injury|pressure ulcer|waterlow|skin integrity|skin assessment|wound classification)\b/.test(fullText)) facets.risk.push("pressure-injury-skin");
  if (/\b(?:resuscitation|code blue|cpr\b|basic life support|bls\b|advanced life support|als\b|pals\b|defibrillat)\b/.test(fullText)) facets.risk.push("resuscitation-code-blue");

  // ── Clinical Systems & Software (mapped to workflow) ────────────────────
  if (/\b(?:webpas|patient administration system|pas downtime)\b/.test(fullText)) facets.workflow.push("webpas");
  if (/\b(?:dmr\b|digital medical record|scanning process|medical chart scan)\b/.test(fullText)) facets.workflow.push("dmr");
  if (/\b(?:bossnet|clinical portal|electronic medical chart)\b/.test(fullText)) facets.workflow.push("bossnet");
  if (/\b(?:epma\b|electronic prescribing|medication prescribing|medications-prescribing)\b/.test(fullText)) facets.workflow.push("epma");
  if (/\b(?:datix|riskman|incident logging|incident report system)\b/.test(fullText)) facets.workflow.push("datix-riskman");
  if (/\b(?:hss\b|health support services|lattice\b|payroll system|timesheet online|rostering online|ros\b)\b/.test(fullText)) facets.workflow.push("hss-payroll-rostering");
  if (/\b(?:pats online|pats registration|patient assisted travel scheme online)\b/.test(fullText)) facets.workflow.push("pats-online");
  if (/\b(?:etg\b|therapeutic guidelines|drug formulary|medication formulary lookup)\b/.test(fullText)) facets.workflow.push("etg-formulary");

  // ── Cultural & Access Equity (mapped to workflow) ───────────────────────
  if (/\b(?:voluntary assisted dying|vad\b|vad substance|vad protocol)\b/.test(fullText)) facets.workflow.push("voluntary-assisted-dying");
  if (/\b(?:advance care planning|advance health directive|ahd\b|enduring power|epg\b|goals of care)\b/.test(fullText)) facets.workflow.push("advance-care-planning");
  if (/\b(?:child protection|mandatory reporting|child abuse|domestic violence screening|fdv screening)\b/.test(fullText)) facets.workflow.push("child-protection-safety");
  if (/\b(?:disability access|cognitive disability|dementia support|sensory impairment|physical access)\b/.test(fullText)) facets.workflow.push("disability-access");
  if (/\b(?:aboriginal health|cultural safety|indigenous health|liaison officer|kara maar)\b/.test(fullText)) facets.workflow.push("aboriginal-health");
  if (/\b(?:language interpreter|translator|multicultural access|deaf access|hearing impaired|cald\b)\b/.test(fullText)) facets.workflow.push("language-interpreter");

  return {
    population: uniqueStrings(facets.population),
    setting: uniqueStrings(facets.setting),
    service: uniqueStrings(facets.service),
    topic: uniqueStrings(facets.topic),
    workflow: uniqueStrings(facets.workflow),
    medication: uniqueStrings(facets.medication),
    risk: uniqueStrings(facets.risk),
  };
}

function profileLabels(profile: DocumentOrganizationProfile): OrganizationGeneratedLabel[] {
  const labels: OrganizationGeneratedLabel[] = [];
  if (profile.site.label)
    labels.push({ label: profile.site.label, label_type: "site", confidence: profile.site.confidence });
  if (profile.document_type.label !== "unknown") {
    labels.push({
      label: profile.document_type.label,
      label_type: "document_type",
      confidence: profile.document_type.confidence,
    });
  }
  for (const [label_type, values] of Object.entries(profile.secondary_facets) as Array<
    [Exclude<DocumentLabelType, "site" | "document_type" | "risk" | "custom">, string[]]
  >) {
    for (const label of values) labels.push({ label, label_type, confidence: 0.78 });
  }
  return labels;
}

function existingOrganizationProfile(metadata: unknown): DocumentOrganizationProfile | null {
  const value = metadataRecord(metadata).organization_profile;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Partial<DocumentOrganizationProfile>;
  return profile.review_status === "manual_override" && typeof profile.canonical_display_title === "string"
    ? (profile as DocumentOrganizationProfile)
    : null;
}

export function classifyDocumentOrganization(input: OrganizationDocumentInput) {
  const manualProfile = existingOrganizationProfile(input.metadata);
  if (manualProfile) {
    const profile = {
      ...manualProfile,
      canonical_display_title: manualProfile.canonical_display_title || canonicalDocumentDisplayTitle(input),
      review_status: "manual_override" as const,
    };
    return {
      profile,
      labels: profileLabels(profile),
      metadata: {
        organization_profile: profile,
        organization_profile_version: organizationProfileVersion,
      },
    };
  }

  const raw_bracket_tags = extractDocumentBracketTags(input.title, input.file_name, input.source_path);
  const site = classifySite(input, raw_bracket_tags);
  const document_type = classifyDocumentType(input);

  const type_confident = document_type.label !== "unknown" && document_type.confidence >= 0.7;
  const site_confident = site.label || site.candidates.length === 0;
  const review_status = type_confident && site_confident ? "confident" : "needs_review";

  const profile: DocumentOrganizationProfile = {
    canonical_display_title: canonicalDocumentDisplayTitle(input),
    raw_bracket_tags,
    site,
    document_type,
    secondary_facets: secondaryFacets(raw_bracket_tags, input.title, `${input.contentText ?? ""} ${input.summaryText ?? ""}`),
    review_status,
  };

  return {
    profile,
    labels: profileLabels(profile),
    metadata: {
      organization_profile: profile,
      organization_profile_version: organizationProfileVersion,
    },
  };
}
