export type ClinicalVocabularyType =
  | "medication"
  | "lab"
  | "service"
  | "form"
  | "risk"
  | "workflow"
  | "document_title"
  | "clinical_term"
  | "typo";

export type ClinicalVocabularyEntry = {
  canonical: string;
  aliases: string[];
  type: ClinicalVocabularyType;
  weight?: number;
};

const entries: ClinicalVocabularyEntry[] = [
  {
    canonical: "long acting injectable",
    aliases: ["lai", "depot", "depot injection", "long-acting injectable", "long acting injection"],
    type: "medication",
    weight: 1.25,
  },
  {
    canonical: "absolute neutrophil count",
    aliases: ["anc", "neutrophil count", "neutrophils"],
    type: "lab",
    weight: 1.25,
  },
  {
    canonical: "full blood count",
    aliases: ["fbc", "blood count", "white cell count", "wcc", "wbc"],
    type: "lab",
    weight: 1.2,
  },
  { canonical: "liver function tests", aliases: ["lft", "lfts"], type: "lab", weight: 1.05 },
  { canonical: "electrocardiogram", aliases: ["ecg", "ekg"], type: "lab", weight: 1.05 },
  { canonical: "corrected qt interval", aliases: ["qtc", "qt interval"], type: "lab", weight: 1.1 },
  {
    canonical: "national outcomes and casemix collection",
    aliases: ["nocc", "outcome measures"],
    type: "clinical_term",
    weight: 1.1,
  },
  { canonical: "health of the nation outcome scales", aliases: ["honos"], type: "clinical_term", weight: 1.05 },
  {
    canonical: "health of the nation outcome scales for children and adolescents",
    aliases: ["honosca"],
    type: "clinical_term",
    weight: 1.05,
  },
  { canonical: "community treatment team", aliases: ["ctt"], type: "service", weight: 1.05 },
  { canonical: "mental health assessment team", aliases: ["mhat"], type: "service", weight: 1.05 },
  { canonical: "adult community mental health service", aliases: ["acmhs"], type: "service", weight: 1.05 },
  { canonical: "armadale kelmscott group", aliases: ["akg"], type: "service", weight: 1.05 },
  { canonical: "mental health service procedure", aliases: ["mhsp"], type: "document_title", weight: 1 },
  { canonical: "electroconvulsive therapy", aliases: ["ect"], type: "workflow", weight: 1.05 },
  { canonical: "emergency department", aliases: ["ed"], type: "service", weight: 1.05 },
  { canonical: "intramuscular", aliases: ["im"], type: "workflow", weight: 1.05 },
  { canonical: "oral", aliases: ["po"], type: "workflow", weight: 1.05 },
  { canonical: "as required", aliases: ["prn"], type: "workflow", weight: 1.05 },
  {
    canonical: "clozapine",
    aliases: ["clozaril", "clozapin", "clozapinw", "clozapene"],
    type: "medication",
    weight: 1.3,
  },
  { canonical: "lithium", aliases: ["lithum", "lithium carbonate", "lithium level"], type: "medication", weight: 1.25 },
  { canonical: "olanzapine", aliases: ["zyprexa"], type: "medication", weight: 1.05 },
  { canonical: "lorazepam", aliases: ["ativan"], type: "medication", weight: 1.05 },
  { canonical: "haloperidol", aliases: ["haldol"], type: "medication", weight: 1.05 },
  { canonical: "promethazine", aliases: ["phenergan"], type: "medication", weight: 1.05 },
  { canonical: "diazepam", aliases: ["valium"], type: "medication", weight: 1.05 },
  { canonical: "risperidone", aliases: ["risperdal"], type: "medication", weight: 1.05 },
  { canonical: "quetiapine", aliases: ["seroquel"], type: "medication", weight: 1.05 },
  {
    canonical: "clozapine monitoring",
    aliases: ["clozapine monitering", "clozapin monitoring"],
    type: "workflow",
    weight: 1.2,
  },
  { canonical: "discharge planning", aliases: ["dischage planning", "discharge documentation"], type: "workflow" },
  { canonical: "admission", aliases: ["admisson"], type: "workflow" },
  { canonical: "prescribing", aliases: ["prescribng"], type: "workflow" },
  { canonical: "monitoring", aliases: ["monitring", "monitor"], type: "workflow" },
  { canonical: "agitation", aliases: ["agitaton", "agitationn"], type: "risk" },
  { canonical: "arousal", aliases: ["arousl", "arrousal"], type: "risk" },
  { canonical: "neutropenia", aliases: ["neutropena"], type: "risk" },
  { canonical: "myocarditis", aliases: ["myocardits"], type: "risk" },
  { canonical: "metabolic monitoring", aliases: ["metbolic monitoring", "metabolic screening"], type: "workflow" },
  { canonical: "patient safety plan", aliases: ["safety plan", "pt safety plan"], type: "form", weight: 1.1 },
  // Systematic Medical Term Expansion (RAG-E1)
  { canonical: "extrapyramidal side effects", aliases: ["epse", "eps", "dystonia", "akathisia", "parkinsonism", "tardive dyskinesia"], type: "risk", weight: 1.1 },
  { canonical: "neuroleptic malignant syndrome", aliases: ["nms", "hyperthermia", "muscle rigidity", "autonomic instability"], type: "risk", weight: 1.2 },
  { canonical: "serotonin syndrome", aliases: ["serotonin toxicity", "shivering", "diarrhea", "muscle rigidity", "fever", "seizures"], type: "risk", weight: 1.2 },
  { canonical: "anticholinergic side effects", aliases: ["anticholinergic toxicity", "dry mouth", "blurred vision", "constipation", "urinary retention", "tachycardia"], type: "risk", weight: 1.1 },
  { canonical: "metabolic syndrome", aliases: ["weight gain", "dyslipidemia", "hyperglycemia", "hypertension", "waist circumference"], type: "risk", weight: 1.1 },
  { canonical: "renal function", aliases: ["egfr", "creatinine", "kidney function", "urea", "electrolytes", "u&e"], type: "lab", weight: 1.1 },
  { canonical: "thyroid function", aliases: ["tft", "tsh", "free t4", "t3"], type: "lab", weight: 1.1 },
  { canonical: "prolactin level", aliases: ["hyperprolactinemia", "prolactin"], type: "lab", weight: 1.1 },
  { canonical: "body mass index", aliases: ["bmi", "weight", "height"], type: "lab", weight: 1.05 },
  { canonical: "blood pressure", aliases: ["bp", "hypertension", "hypotension", "orthostatic hypotension"], type: "lab", weight: 1.1 },
];

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function termPattern(value: string) {
  return new RegExp(`(?:^|\\s)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}(?:\\s|$)`);
}

export function clinicalVocabularyEntries() {
  return entries;
}

export function clinicalVocabularyMatches(text: string, limit = 24) {
  const normalizedText = normalize(text);
  const matches: ClinicalVocabularyEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const terms = [entry.canonical, ...entry.aliases].map(normalize).filter(Boolean);
    if (!terms.some((term) => termPattern(term).test(normalizedText))) continue;
    const key = `${entry.type}:${entry.canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(entry);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function expandClinicalVocabularyText(text: string, limit = 48) {
  const additions = new Set<string>();
  for (const entry of clinicalVocabularyMatches(text, limit)) {
    additions.add(entry.canonical);
    for (const alias of entry.aliases.slice(0, 6)) additions.add(alias);
  }
  return Array.from(additions).slice(0, limit);
}

export function clinicalVocabularySearchText(text: string, limit = 48) {
  const additions = expandClinicalVocabularyText(text, limit);
  return additions.length ? `${text} ${additions.join(" ")}` : text;
}

export function clinicalVocabularyTerms(text: string, limit = 32) {
  return Array.from(
    new Set(
      clinicalVocabularyMatches(text, limit).flatMap((entry) => [
        entry.canonical,
        entry.type,
        ...entry.aliases.slice(0, 4),
      ]),
    ),
  ).slice(0, limit);
}
