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

type SiteCandidate = {
  label: string;
  short_label: string;
  raw_tag: string;
  kind: DocumentOrganizationSiteKind;
  confidence: number;
  evidence_sources: string[];
};

type SecondaryFacet = {
  label: string;
  label_type: Extract<
    DocumentLabelType,
    "population" | "setting" | "service" | "topic" | "workflow" | "medication" | "risk"
  >;
};

type SmartFacetRule = SecondaryFacet & {
  strong: RegExp[];
  body?: RegExp[];
  minBodyMatches?: number;
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
  {
    canonical: "BMJ Best Practice",
    rawTags: ["bmj"],
    kind: "reference_collection",
    // Audit M7: require the "bmj" token. The generic phrase "best practice"
    // appears in ordinary local policies ("in line with best practice…") and
    // falsely attributed them to an external commercial reference.
    evidence: [/\bbmj\b/i],
  },
];

const generalClinicalReferenceSite = {
  label: "General clinical reference",
  short_label: "GEN",
  raw_tag: "general-reference",
  kind: "reference_collection" as const,
  confidence: 0.76,
  evidence_sources: ["fallback:non_site_specific_reference"],
  candidates: [],
};

function hasGeneralClinicalReferenceEvidence(input: OrganizationDocumentInput) {
  const text = [
    input.title,
    input.file_name,
    input.source_path,
    input.contentText,
    metadataString(input.metadata, "source_type"),
    metadataString(input.metadata, "category"),
  ]
    .filter(Boolean)
    .join(" ");
  return /\b(?:clinical reference|reference material|clinical guideline|practice guideline|guidelines?|best practice|formulary|therapeutic guideline|clinical handbook)\b/i.test(
    text,
  );
}

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
  { label: "procedure", confidence: 0.84, patterns: [/\bward routine\b/i, /\broutine\b/i] },
  { label: "guideline", confidence: 0.84, patterns: [/\bguideline\b/i, /\bguidance\b/i] },
  { label: "protocol", confidence: 0.84, patterns: [/\bprotocol\b/i, /\bcontingency plan\b/i, /\bcardiac arrest\b/i] },
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
      /\bprint ready pi\b/i,
      /\bconsumer info\b/i,
      /\bbooklet\b/i,
      /\bflyer\b/i,
      /\bposter\b/i,
      /\btips?\s+for\b/i,
      /\bcaring for your\b/i,
      /\bhuffers and puffers\b/i,
      /\bfood and nutrition\b/i,
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

const secondaryFacetLimits: Record<keyof DocumentOrganizationProfile["secondary_facets"], number> = {
  population: 2,
  setting: 2,
  service: 2,
  topic: 4,
  workflow: 2,
  medication: 3,
  risk: 2,
};

const smartFacetRules: SmartFacetRule[] = [
  // Population
  {
    label: "neonatal",
    label_type: "population",
    strong: [/\b(?:neonatal|neonate|newborn|nicu)\b/i],
    body: [/\b(?:neonatal|neonate|newborn|nicu)\b/i],
  },
  {
    label: "paediatric",
    label_type: "population",
    strong: [/\b(?:paediatric|pediatric|child|children|perth children'?s hospital|pch)\b/i],
    body: [/\b(?:paediatric|pediatric|child|children)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "youth",
    label_type: "population",
    strong: [/\b(?:youth|adolescent|teen|young person|young people|camhs)\b/i],
    body: [/\b(?:youth|adolescent|young person|young people)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "geriatric",
    label_type: "population",
    strong: [/\b(?:older adult|geriatric|aged care|elderly|mhoa)\b/i],
    body: [/\b(?:older adult|geriatric|elderly|65 years)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "adult",
    label_type: "population",
    strong: [/\b(?:adult|adults)\b/i],
    body: [/\b(?:adult|adults)\b/i],
    minBodyMatches: 4,
  },

  // Settings
  {
    label: "inpatient",
    label_type: "setting",
    strong: [/\b(?:inpatient|ward|admitted|admission|bed management|inpatient unit)\b/i],
    body: [/\b(?:inpatient|ward|admitted|admission)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "outpatient",
    label_type: "setting",
    strong: [/\b(?:outpatient|ambulatory|clinic|day procedure|day surgery|day unit)\b/i],
    body: [/\b(?:outpatient|ambulatory|clinic)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "community",
    label_type: "setting",
    strong: [/\b(?:community|home visit|outreach|hospital in the home|cpop)\b/i],
    body: [/\b(?:community|home visit|outreach|hospital in the home)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "emergency-department",
    label_type: "setting",
    strong: [/\b(?:emergency department|ed\b|triage|resus|trauma bay)\b/i],
    body: [/\b(?:emergency department|triage|resus)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "mental-health-unit",
    label_type: "setting",
    strong: [/\b(?:mental health unit|psychiatric unit|mhu\b|acute mental health|mimidi|seclusion)\b/i],
    body: [/\b(?:mental health unit|psychiatric unit|seclusion)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "icu-hdu",
    label_type: "setting",
    strong: [/\b(?:icu\b|intensive care|hdu\b|high dependency|critical care)\b/i],
    body: [/\b(?:icu\b|intensive care|hdu\b|critical care)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "operating-theatre",
    label_type: "setting",
    strong: [/\b(?:operating theatre|operating room|theatre suite|perioperative|pacu\b|recovery room)\b/i],
    body: [/\b(?:operating theatre|operating room|theatre suite|pacu\b)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "maternity-unit",
    label_type: "setting",
    strong: [/\b(?:maternity unit|birth suite|labour ward|antenatal ward|postnatal ward|birthing)\b/i],
    body: [/\b(?:maternity unit|birth suite|labour ward|antenatal|postnatal)\b/i],
    minBodyMatches: 2,
  },

  // Services / clinical areas
  {
    label: "mental-health",
    label_type: "service",
    strong: [/\b(?:mental health|psychiatr|psychosis|schizophrenia|bipolar|ect\b|seclusion|camhs|mhoa)\b/i],
    body: [/\b(?:mental health|psychiatr|psychosis|schizophrenia|bipolar|seclusion)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "emergency-medicine",
    label_type: "service",
    strong: [/\b(?:emergency medicine|emergency department|ed\b|trauma|resus|triage)\b/i],
    body: [/\b(?:emergency department|triage|resus|trauma)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "pharmacy-medications",
    label_type: "service",
    strong: [/\b(?:pharmacy|pharmacist|drug guideline|medication management|medicine management|formulary)\b/i],
    body: [/\b(?:pharmacy|pharmacist|medication management|formulary)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "obstetrics-maternity",
    label_type: "service",
    strong: [/\b(?:obstetric|maternity|labour|birth|antenatal|postnatal|perinatal|midwif|kemh|pregnan)\b/i],
    body: [/\b(?:obstetric|maternity|antenatal|postnatal|perinatal|pregnan)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "neonatology",
    label_type: "service",
    strong: [/\b(?:neonatal|nicu|neonate|newborn)\b/i],
    body: [/\b(?:neonatal|nicu|neonate|newborn)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "intensive-care",
    label_type: "service",
    strong: [/\b(?:intensive care|icu\b|critical care|hdu\b|high dependency|ventilat|vasopressor)\b/i],
    body: [/\b(?:intensive care|icu\b|critical care|hdu\b|ventilat)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "perioperative-anaesthesia",
    label_type: "service",
    strong: [/\b(?:perioperative|anaesth|anesthes|theatre|operating|preoperative|post-?operative|surgical)\b/i],
    body: [/\b(?:perioperative|anaesth|anesthes|operating theatre|preoperative|post-?operative)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "infectious-disease",
    label_type: "service",
    strong: [/\b(?:infection control|infectious disease|antimicrobial|antibiotic|isolation|sepsis)\b/i],
    body: [/\b(?:infection control|infectious disease|antimicrobial|antibiotic|isolation|sepsis)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "oncology-haematology",
    label_type: "service",
    strong: [/\b(?:oncolog|haematolog|hematolog|chemotherapy|transfusion|apheresis|leukaemia)\b/i],
    body: [/\b(?:oncolog|haematolog|hematolog|chemotherapy|transfusion|apheresis)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "cardiology",
    label_type: "service",
    strong: [/\b(?:cardiol|cardiac|heart failure|arrhythmia|ecg\b|pacemaker|atrial fibrillation|coronary)\b/i],
    body: [/\b(?:cardiol|cardiac|heart failure|arrhythmia|ecg\b|pacemaker)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "orthopaedics",
    label_type: "service",
    strong: [/\b(?:orthopaed|orthoped|fracture|bone|joint|spine|musculoskeletal|hip replacement)\b/i],
    body: [/\b(?:orthopaed|orthoped|fracture|joint|spine|musculoskeletal)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "renal-nephrology",
    label_type: "service",
    strong: [/\b(?:renal|nephrol|dialysis|haemodialysis|hemodialysis|kidney)\b/i],
    body: [/\b(?:renal|nephrol|dialysis|kidney)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "gastroenterology",
    label_type: "service",
    strong: [/\b(?:gastroenterol|endoscopy|colonoscopy|gastroscopy|bowel|liver|hepat|ibd\b)\b/i],
    body: [/\b(?:gastroenterol|endoscopy|colonoscopy|gastroscopy|bowel|liver)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "respiratory",
    label_type: "service",
    strong: [/\b(?:respiratory|pulmonol|lung|sleep apnoea|cpap\b|spirometry|asthma|copd\b)\b/i],
    body: [/\b(?:respiratory|lung|sleep apnoea|cpap\b|spirometry|asthma|copd\b)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "neurology",
    label_type: "service",
    strong: [/\b(?:neurol|seizure|epilepsy|stroke|tia\b|neuropsychol|parkinson|dementia|delirium)\b/i],
    body: [/\b(?:neurol|seizure|epilepsy|stroke|dementia|delirium)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "palliative-care",
    label_type: "service",
    strong: [/\b(?:palliative|end of life|dying|comfort care|hospice)\b/i],
    body: [/\b(?:palliative|end of life|comfort care|hospice)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "allied-health",
    label_type: "service",
    strong: [
      /\b(?:allied health|physiotherap|occupational therap|speech pathol|social work|dietetic|rehabilitation)\b/i,
    ],
    body: [/\b(?:allied health|physiotherap|occupational therap|speech pathol|social work|dietetic)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "diabetes-endocrinology",
    label_type: "service",
    strong: [/\b(?:diabetes|endocrin|insulin|hypoglycaem|dka\b|diabetic ketoacidosis|thyroid|adrenal)\b/i],
    body: [/\b(?:diabetes|endocrin|insulin|hypoglycaem|diabetic ketoacidosis)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "urology",
    label_type: "service",
    strong: [/\b(?:urology|urolog|catheter|urethral|bladder|prostate)\b/i],
    body: [/\b(?:urology|urolog|catheter|urethral|bladder|prostate)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "wound-management",
    label_type: "service",
    strong: [/\b(?:wound|pressure injury|pressure ulcer|skin integrity|dressing)\b/i],
    body: [/\b(?:wound|pressure injury|pressure ulcer|skin integrity|dressing)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "pain-management",
    label_type: "service",
    strong: [/\b(?:pain management|analgesia|acute pain|chronic pain)\b/i],
    body: [/\b(?:pain management|analgesia|acute pain|chronic pain)\b/i],
    minBodyMatches: 2,
  },

  // Medication labels
  { label: "lithium", label_type: "medication", strong: [/\blithium\b/i], body: [/\blithium\b/i] },
  { label: "clozapine", label_type: "medication", strong: [/\bclozapine\b/i], body: [/\bclozapine\b/i] },
  {
    label: "mood-stabilisers",
    label_type: "medication",
    strong: [/\b(?:mood stabiliser|mood stabilizer|valproate|carbamazepine|lamotrigine|lithium)\b/i],
    body: [/\b(?:mood stabiliser|mood stabilizer|valproate|carbamazepine|lamotrigine|lithium)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "antipsychotics",
    label_type: "medication",
    strong: [/\b(?:antipsychotic|olanzapine|quetiapine|risperidone|haloperidol|droperidol|clozapine)\b/i],
    body: [/\b(?:antipsychotic|olanzapine|quetiapine|risperidone|haloperidol|droperidol|clozapine)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "long-acting-injectable",
    label_type: "medication",
    strong: [/\b(?:long acting injectable|long-acting injectable|depot|lai\b)\b/i],
    body: [/\b(?:long acting injectable|long-acting injectable|depot|lai\b)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "opioids",
    label_type: "medication",
    strong: [/\b(?:opioid|morphine|fentanyl|oxycodone|methadone|buprenorphine|naloxone)\b/i],
    body: [/\b(?:opioid|morphine|fentanyl|oxycodone|methadone|buprenorphine|naloxone)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "insulin",
    label_type: "medication",
    strong: [/\b(?:insulin|dka\b|diabetic ketoacidosis|hypoglycaem|hyperglycaem)\b/i],
    body: [/\b(?:insulin|diabetic ketoacidosis|hypoglycaem|hyperglycaem)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "antimicrobials",
    label_type: "medication",
    strong: [/\b(?:antimicrobial|antibiotic|vancomycin|gentamicin|penicillin|meropenem)\b/i],
    body: [/\b(?:antimicrobial|antibiotic|vancomycin|gentamicin|penicillin|meropenem)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "anticoagulants",
    label_type: "medication",
    strong: [/\b(?:anticoagul|warfarin|heparin|enoxaparin|apixaban|rivaroxaban|dabigatran)\b/i],
    body: [/\b(?:anticoagul|warfarin|heparin|enoxaparin|apixaban|rivaroxaban|dabigatran)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "blood-products",
    label_type: "medication",
    strong: [/\b(?:blood product|transfusion|packed red|platelet|fresh frozen plasma|ffp\b)\b/i],
    body: [/\b(?:blood product|transfusion|packed red|platelet|fresh frozen plasma|ffp\b)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "iv-medications",
    label_type: "medication",
    strong: [/\b(?:iv medication|iv drug|intravenous medication|intravenous drug|iv infusion)\b/i],
    body: [/\b(?:iv medication|iv drug|intravenous medication|intravenous drug|iv infusion)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "controlled-drugs",
    label_type: "medication",
    strong: [/\b(?:controlled drug|schedule 8|schedule 4|restricted medication|s8\b|s4\b)\b/i],
    body: [/\b(?:controlled drug|schedule 8|schedule 4|restricted medication|s8\b|s4\b)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "chemotherapy",
    label_type: "medication",
    strong: [/\b(?:chemotherapy|cytotoxic|antineoplastic|anticancer)\b/i],
    body: [/\b(?:chemotherapy|cytotoxic|antineoplastic|anticancer)\b/i],
    minBodyMatches: 2,
  },

  // Topics
  { label: "electroconvulsive-therapy", label_type: "topic", strong: [/\b(?:ect|electroconvulsive)\b/i] },
  { label: "suicide-self-harm", label_type: "topic", strong: [/\b(?:suicide|suicidal|self harm|self-harm)\b/i] },
  {
    label: "substance-use-alcohol-and-drugs",
    label_type: "topic",
    strong: [
      /\b(?:substance use|alcohol|drug and alcohol|withdrawal|intoxication|methamphetamine|opioid pharmacotherapy)\b/i,
    ],
    body: [/\b(?:substance use|alcohol|withdrawal|intoxication|methamphetamine)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "aggression-violence-code-black",
    label_type: "topic",
    strong: [/\b(?:aggression|violence|violent|code black|duress|behavioural disturbance|behavioral disturbance)\b/i],
    body: [/\b(?:aggression|violence|code black|duress|behavioural disturbance|behavioral disturbance)\b/i],
    minBodyMatches: 2,
  },
  { label: "seclusion-restraint", label_type: "topic", strong: [/\b(?:seclusion|restraint|restrictive practice)\b/i] },
  { label: "missing-person-awol", label_type: "topic", strong: [/\b(?:missing person|absent without leave|awol)\b/i] },
  {
    label: "discharge-follow-up",
    label_type: "topic",
    strong: [/\b(?:discharge|follow up|follow-up|post discharge)\b/i],
  },
  {
    label: "admission-waitlist-bed-access",
    label_type: "topic",
    strong: [/\b(?:admission|admit|waitlist|bed access|bed management|entry protocol)\b/i],
    body: [/\b(?:admission|waitlist|bed access|bed management)\b/i],
    minBodyMatches: 4,
  },
  { label: "transport-transfer-escort", label_type: "topic", strong: [/\b(?:transport|transfer|escort)\b/i] },
  {
    label: "rights-carers-advocates",
    label_type: "topic",
    strong: [/\b(?:rights|carer|support person|advocate|charter)\b/i],
  },
  {
    label: "consent-capacity-confidentiality",
    label_type: "topic",
    strong: [/\b(?:consent|capacity|confidentiality|privacy|information sharing)\b/i],
  },
  {
    label: "physical-health-care",
    label_type: "topic",
    strong: [/\b(?:physical health|metabolic|weight|blood pressure|ecg|medical clearance)\b/i],
    body: [/\b(?:physical health|metabolic|blood pressure|ecg|medical clearance)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "observation-safety-planning",
    label_type: "topic",
    strong: [/\b(?:observation|safety plan|safety planning|risk assessment|clinical alert)\b/i],
    body: [/\b(?:observation|safety plan|risk assessment|clinical alert)\b/i],
    minBodyMatches: 4,
  },
  {
    label: "incident-notification-open-disclosure",
    label_type: "topic",
    strong: [/\b(?:incident|notification|notify|open disclosure|riskman|datix)\b/i],
    body: [/\b(?:incident|notification|open disclosure|riskman|datix)\b/i],
    minBodyMatches: 4,
  },
  {
    label: "clinical-supervision-staff-support",
    label_type: "topic",
    strong: [/\b(?:clinical supervision|staff support|vicarious trauma|supervision)\b/i],
  },
  { label: "psychosis-schizophrenia", label_type: "topic", strong: [/\b(?:psychosis|psychotic|schizophrenia)\b/i] },
  { label: "depression-mood-disorders", label_type: "topic", strong: [/\b(?:depression|depressive|mood disorder)\b/i] },
  { label: "bipolar-mood-episode", label_type: "topic", strong: [/\b(?:bipolar|mania|manic|mood episode)\b/i] },
  { label: "eating-disorders", label_type: "topic", strong: [/\b(?:eating disorder|anorexia|bulimia)\b/i] },
  { label: "dementia-delirium", label_type: "topic", strong: [/\b(?:dementia|delirium|cognitive impairment)\b/i] },
  { label: "anxiety-trauma", label_type: "topic", strong: [/\b(?:anxiety|trauma|ptsd|panic)\b/i] },
  {
    label: "personality-disorder",
    label_type: "topic",
    strong: [/\b(?:personality disorder|borderline personality)\b/i],
  },
  {
    label: "perinatal-mental-health",
    label_type: "topic",
    strong: [/\b(?:perinatal mental health|mother baby|postnatal depression)\b/i],
  },
  {
    label: "child-protection-safeguarding",
    label_type: "topic",
    strong: [/\b(?:child protection|safeguard|family violence|mandatory reporting|child abuse)\b/i],
  },
  {
    label: "cognitive-impairment-learning-disability",
    label_type: "topic",
    strong: [/\b(?:cognitive impairment|learning disability|intellectual disability|cognitive delay)\b/i],
  },
  {
    label: "medical-clearance",
    label_type: "topic",
    strong: [/\b(?:medical clearance|medically cleared|medical assessment)\b/i],
  },
  {
    label: "shared-care-gp-liaison",
    label_type: "topic",
    strong: [/\b(?:shared care|gp liaison|general practitioner)\b/i],
  },
  {
    label: "care-coordination-case-management",
    label_type: "topic",
    strong: [/\b(?:care coordination|case management|care plan|case manager)\b/i],
  },
  { label: "mental-state-examination", label_type: "topic", strong: [/\b(?:mental state examination|mse\b)\b/i] },
  { label: "risk-formulation", label_type: "topic", strong: [/\b(?:risk formulation|risk management plan)\b/i] },
  { label: "crisis-plan", label_type: "topic", strong: [/\b(?:crisis plan|crisis response)\b/i] },
  { label: "mental-health-act", label_type: "topic", strong: [/\b(?:mental health act|mha\b)\b/i] },
  {
    label: "cto-involuntary-care",
    label_type: "topic",
    strong: [/\b(?:community treatment order|cto\b|involuntary|detention)\b/i],
  },

  // Workflow, document intent, care phase, and audience
  {
    label: "assessment",
    label_type: "workflow",
    strong: [/\b(?:assess|assessment|screening)\b/i],
    body: [/\b(?:assess|assessment|screening)\b/i],
    minBodyMatches: 6,
  },
  {
    label: "prescribing",
    label_type: "workflow",
    strong: [/\b(?:prescrib|dose|dosing|medication instruction)\b/i],
    body: [/\b(?:prescrib|dose|dosing)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "monitoring",
    label_type: "workflow",
    strong: [/\b(?:monitor|monitoring|baseline test|ongoing test|blood test)\b/i],
    body: [/\b(?:monitor|monitoring|baseline test|ongoing test|blood test)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "escalation",
    label_type: "workflow",
    strong: [/\b(?:escalat|urgent review|notify consultant|senior review)\b/i],
    body: [/\b(?:escalat|urgent review|senior review)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "referral-pathway",
    label_type: "workflow",
    strong: [/\b(?:refer|referral pathway|referral criteria)\b/i],
    body: [/\b(?:refer|referral)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "admission",
    label_type: "workflow",
    strong: [/\b(?:admission|admit|pre-admission)\b/i],
    body: [/\b(?:admission|admit)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "discharge-planning",
    label_type: "workflow",
    strong: [/\b(?:discharge planning|discharge|post-discharge)\b/i],
    body: [/\b(?:discharge planning|post-discharge)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "clinical-handover",
    label_type: "workflow",
    strong: [/\b(?:handover|isbar)\b/i],
    body: [/\b(?:handover|isbar)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "documentation-requirement",
    label_type: "workflow",
    strong: [/\b(?:document|documentation|record in|form required)\b/i],
    body: [/\b(?:documentation|record in|form required)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "notification-reporting",
    label_type: "workflow",
    strong: [/\b(?:notify|notification|reporting|report to)\b/i],
    body: [/\b(?:notify|notification|reporting)\b/i],
    minBodyMatches: 3,
  },
  { label: "de-escalation", label_type: "workflow", strong: [/\b(?:de-escalat|deescalat)\b/i] },
  {
    label: "follow-up",
    label_type: "workflow",
    strong: [/\b(?:follow up|follow-up|review appointment)\b/i],
    body: [/\b(?:follow up|follow-up)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "decision-support",
    label_type: "workflow",
    strong: [/\b(?:algorithm|flowchart|decision tree|criteria|threshold)\b/i],
  },
  {
    label: "patient-information",
    label_type: "workflow",
    strong: [/\b(?:patient information|consumer information|factsheet|leaflet|for patients)\b/i],
  },
  {
    label: "staff-guidance",
    label_type: "workflow",
    strong: [/\b(?:staff guidance|staff guide|orientation|training|education)\b/i],
  },
  {
    label: "legal-governance",
    label_type: "workflow",
    strong: [/\b(?:legal|governance|rights|mental health act)\b/i],
    body: [/\b(?:legal|governance|rights|mental health act)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "audit-compliance",
    label_type: "workflow",
    strong: [/\b(?:audit|compliance|quality improvement|review criteria)\b/i],
    body: [/\b(?:audit|compliance)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "training-education",
    label_type: "workflow",
    strong: [/\b(?:training|education|orientation|competenc)\b/i],
    body: [/\b(?:training|education|orientation|competenc)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "nursing-midwifery",
    label_type: "workflow",
    strong: [/\b(?:nursing|nurse|midwif|clinical nurse)\b/i],
    body: [/\b(?:nursing|nurse|midwif)\b/i],
    minBodyMatches: 4,
  },
  {
    label: "medical-officer",
    label_type: "workflow",
    strong: [/\b(?:medical officer|doctor|registrar|consultant|prescriber|jmo\b)\b/i],
    body: [/\b(?:medical officer|registrar|consultant|prescriber)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "allied-health",
    label_type: "workflow",
    strong: [/\b(?:allied health|physiotherap|occupational therap|social work|speech pathol)\b/i],
    body: [/\b(?:allied health|physiotherap|occupational therap|social work|speech pathol)\b/i],
    minBodyMatches: 3,
  },
  {
    label: "pharmacy-staff",
    label_type: "workflow",
    strong: [/\b(?:pharmacy staff|pharmacist|dispensing|formulary)\b/i],
    body: [/\b(?:pharmacist|dispensing|formulary)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "mental-health-practitioners",
    label_type: "workflow",
    strong: [/\b(?:mental health clinician|mental health practitioner|case manager|psychiatric nurse|camhs staff)\b/i],
  },
  {
    label: "clerical-admin",
    label_type: "workflow",
    strong: [/\b(?:clerical|ward clerk|medical records|receptionist|admin)\b/i],
    body: [/\b(?:clerical|ward clerk|medical records|receptionist)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "security-orderlies",
    label_type: "workflow",
    strong: [/\b(?:security|orderly|orderlies|escort duty)\b/i],
    body: [/\b(?:security|orderly|orderlies)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "aboriginal-health",
    label_type: "workflow",
    strong: [/\b(?:aboriginal health|cultural safety|indigenous health|kara maar)\b/i],
  },
  {
    label: "language-interpreter",
    label_type: "workflow",
    strong: [/\b(?:language interpreter|interpreter|translator|cald\b)\b/i],
  },
  {
    label: "child-protection-safety",
    label_type: "workflow",
    strong: [/\b(?:child protection|mandatory reporting|child abuse|family violence)\b/i],
  },
  {
    label: "advance-care-planning",
    label_type: "workflow",
    strong: [/\b(?:advance care planning|advance health directive|goals of care)\b/i],
  },
  { label: "voluntary-assisted-dying", label_type: "workflow", strong: [/\b(?:voluntary assisted dying|vad\b)\b/i] },
  {
    label: "disability-access",
    label_type: "workflow",
    strong: [/\b(?:disability access|sensory impairment|physical access)\b/i],
  },
  { label: "webpas", label_type: "workflow", strong: [/\b(?:webpas|patient administration system|pas downtime)\b/i] },
  { label: "dmr", label_type: "workflow", strong: [/\b(?:dmr\b|digital medical record|medical chart scan)\b/i] },
  { label: "bossnet", label_type: "workflow", strong: [/\b(?:bossnet|clinical portal|electronic medical chart)\b/i] },
  { label: "epma", label_type: "workflow", strong: [/\b(?:epma\b|electronic prescribing)\b/i] },
  { label: "datix-riskman", label_type: "workflow", strong: [/\b(?:datix|riskman|incident logging)\b/i] },
  {
    label: "etg-formulary",
    label_type: "workflow",
    strong: [/\b(?:etg\b|therapeutic guidelines|formulary lookup)\b/i],
  },
  {
    label: "finance",
    label_type: "workflow",
    strong: [/\b(?:finance|financial|billing|funding|invoice|payment|cost|budget)\b/i],
  },
  { label: "hr", label_type: "workflow", strong: [/\b(?:human resources|personnel|staffing|recruitment)\b/i] },
  {
    label: "patient assisted travel scheme",
    label_type: "workflow",
    strong: [/\b(?:patient assisted travel scheme|pats\b)\b/i],
  },
  {
    label: "community-program-for-opioid-pharmacotherapy",
    label_type: "workflow",
    strong: [/\b(?:community program for opioid pharmacotherapy|cpop\b)\b/i],
  },

  // Risk and governance
  {
    label: "clinical-risk",
    label_type: "risk",
    strong: [/\b(?:clinical risk|risk assessment|risk management)\b/i],
    body: [/\b(?:clinical risk|risk assessment|risk management)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "medication-risk",
    label_type: "risk",
    strong: [/\b(?:medication risk|high risk medication|high alert medication)\b/i],
    body: [/\b(?:medication risk|high risk medication|high alert medication)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "legal-risk",
    label_type: "risk",
    strong: [/\b(?:legal risk|legal requirement|mental health act)\b/i],
    body: [/\b(?:legal requirement|mental health act)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "safety-incident",
    label_type: "risk",
    strong: [/\b(?:safety incident|incident report|sentinel event|riskman|datix)\b/i],
    body: [/\b(?:safety incident|incident report|sentinel event|riskman|datix)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "mandatory-reporting",
    label_type: "risk",
    strong: [/\b(?:mandatory reporting|reportable incident|notifiable)\b/i],
  },
  {
    label: "infection-prevention",
    label_type: "risk",
    strong: [/\b(?:infection prevention|infection control|ipc\b|isolation precaution|ppe\b)\b/i],
    body: [/\b(?:infection prevention|infection control|isolation precaution)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "deterioration-risk",
    label_type: "risk",
    strong: [/\b(?:deteriorating patient|clinical deterioration|met call|medical emergency)\b/i],
  },
  {
    label: "behavioural-risk",
    label_type: "risk",
    strong: [/\b(?:behavioural risk|behavioral risk|behavioural disturbance|aggression|violence)\b/i],
  },
  { label: "self-harm-risk", label_type: "risk", strong: [/\b(?:self harm|self-harm|suicide|suicidal)\b/i] },
  { label: "violence-risk", label_type: "risk", strong: [/\b(?:violence risk|aggression|code black|duress)\b/i] },
  {
    label: "absconding-risk",
    label_type: "risk",
    strong: [/\b(?:abscond|missing person|awol|absent without leave)\b/i],
  },
  {
    label: "falls-prevention",
    label_type: "risk",
    strong: [/\b(?:falls prevention|fall risk|post fall|falls assessment)\b/i],
  },
  {
    label: "pressure-injury-skin",
    label_type: "risk",
    strong: [/\b(?:pressure injury|pressure ulcer|skin integrity|wound classification)\b/i],
  },
  {
    label: "confidentiality-risk",
    label_type: "risk",
    strong: [/\b(?:confidentiality|privacy breach|information sharing)\b/i],
  },
  {
    label: "capacity-risk",
    label_type: "risk",
    strong: [/\b(?:capacity assessment|impaired capacity|decision making capacity)\b/i],
  },
  {
    label: "high-risk-medication",
    label_type: "risk",
    strong: [/\b(?:high risk medication|lithium|clozapine|insulin|heparin|potassium)\b/i],
    body: [/\b(?:high risk medication|lithium|clozapine|insulin|heparin|potassium)\b/i],
    minBodyMatches: 2,
  },
  {
    label: "blood-safety-transfusion",
    label_type: "risk",
    strong: [/\b(?:blood safety|blood product|transfusion|massive transfusion)\b/i],
  },
  {
    label: "restrictive-practices",
    label_type: "risk",
    strong: [/\b(?:restrictive practice|restraint|chemical restraint|physical restraint|seclusion)\b/i],
  },
  {
    label: "resuscitation-code-blue",
    label_type: "risk",
    strong: [/\b(?:resuscitation|code blue|cpr\b|basic life support|advanced life support|defibrillat)\b/i],
  },
  {
    label: "clinical-handover-escalation",
    label_type: "risk",
    strong: [/\b(?:clinical handover|handover|isbar|escalation protocol|deteriorat)\b/i],
  },
  {
    label: "open-disclosure",
    label_type: "risk",
    strong: [/\b(?:open disclosure|clinical governance|root cause analysis)\b/i],
  },
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

function siteShortLabel(definition: SiteDefinition) {
  const preferred = definition.rawTags.find((rawTag) => /^[a-z0-9]{2,8}$/i.test(rawTag)) ?? definition.rawTags[0];
  const normalized = normalizeText(preferred);
  if (normalized === "wa health") return "WA Health";
  if (normalized === "graylands") return "Graylands";
  return preferred.toUpperCase();
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

// Bracketed segments are the raw-tag channel handled separately by
// extractDocumentBracketTags; they must not leak into the corroborating
// evidence haystack, or a bare "(FSH)" tag would confirm itself.
function withoutBracketSegments(value: string) {
  return value.replace(/[\[(][^\])(]{1,80}[\])]/g, " ");
}

function evidenceText(input: OrganizationDocumentInput) {
  const metadata = metadataRecord(input.metadata);
  return [
    // Audit M6: the title and file name are often the ONLY place a site is
    // named in plain text (e.g. "Sir Charles Gairdner Hospital Sepsis
    // Pathway"); omitting them left such documents site=null/needs_review.
    // Bracket tags are stripped so an uncorroborated "(FSH)" stays a
    // low-confidence candidate (needs_review) rather than self-confirming.
    withoutBracketSegments(input.title ?? ""),
    withoutBracketSegments(input.file_name ?? ""),
    // source_path usually echoes the file name (e.g. "imports/[FSH] x.pdf"),
    // so its bracket segments must be stripped too or a bare tag would
    // self-confirm through this channel (diff-review hardening of M6).
    withoutBracketSegments(input.source_path ?? ""),
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
  const evidence: string[] = [];
  const haystack = evidenceText(input);
  for (const pattern of definition.evidence) {
    if (pattern.test(haystack)) {
      evidence.push(`source:${pattern.source.replaceAll("\\b", "").slice(0, 40)}`);
      break;
    }
  }
  return evidence;
}

function referenceCollectionFromEvidence(input: OrganizationDocumentInput) {
  const haystack = evidenceText(input);
  return siteDefinitions.find((definition) => {
    if (definition.kind !== "reference_collection") return false;
    return definition.evidence.some((pattern) => pattern.test(haystack));
  });
}

function siteCandidateSpecificity(candidate: SiteCandidate) {
  switch (candidate.kind) {
    case "hospital":
      return 5;
    case "health_service":
      return 4;
    case "program":
      return 3;
    case "unit":
      return 2;
    case "reference_collection":
      return 1;
    default:
      return 0;
  }
}

function selectSiteCandidate(candidates: SiteCandidate[]) {
  return [...candidates].sort(
    (left, right) =>
      right.confidence - left.confidence ||
      Number(right.evidence_sources.some((source) => source.startsWith("bracket:"))) -
        Number(left.evidence_sources.some((source) => source.startsWith("bracket:"))) ||
      siteCandidateSpecificity(right) - siteCandidateSpecificity(left),
  )[0];
}

function classifySite(input: OrganizationDocumentInput, rawTags: string[]) {
  const taggedCandidates = rawTags
    .map((tag) => ({ tag, definition: siteDefinitionForTag(tag) }))
    .filter((item): item is { tag: string; definition: SiteDefinition } => Boolean(item.definition))
    .map(({ tag, definition }) => {
      const evidence_sources = siteEvidence(definition, input);
      const confirmed = evidence_sources.length > 0;
      return {
        label: definition.canonical,
        short_label: siteShortLabel(definition),
        raw_tag: tag,
        kind: definition.kind,
        confidence: confirmed ? 0.92 : 0.58,
        evidence_sources: [`bracket:${tag}`, ...evidence_sources],
      };
    });
  const taggedLabels = new Set(taggedCandidates.map((candidate) => candidate.label));
  const sourceCandidates = siteDefinitions
    .filter((definition) => !taggedLabels.has(definition.canonical))
    .map((definition) => ({ definition, evidence_sources: siteEvidence(definition, input) }))
    .filter((item) => item.evidence_sources.length > 0)
    .map(({ definition, evidence_sources }) => ({
      label: definition.canonical,
      short_label: siteShortLabel(definition),
      raw_tag: definition.rawTags[0],
      kind: definition.kind,
      confidence: 0.92,
      evidence_sources,
    }));
  const candidates = [...taggedCandidates, ...sourceCandidates];

  const confirmedCandidates = candidates.filter((candidate) => candidate.confidence >= 0.75);
  const selected = selectSiteCandidate(confirmedCandidates) ?? null;

  // Audit M5: gate the reference fallbacks on the absence of a CONFIRMED
  // candidate, not on candidates.length — an unconfirmed bracket-tag guess
  // (confidence 0.58, no corroborating evidence) used to suppress both
  // fallbacks and leave an obvious clinical reference as site=null.
  const referenceCollection =
    !selected && confirmedCandidates.length === 0 ? referenceCollectionFromEvidence(input) : null;
  if (referenceCollection) {
    return {
      label: referenceCollection.canonical,
      short_label: siteShortLabel(referenceCollection),
      raw_tag: referenceCollection.rawTags[0],
      kind: referenceCollection.kind,
      confidence: 0.86,
      evidence_sources: [`source:${referenceCollection.rawTags[0]}`],
      candidates,
    };
  }

  if (!selected && confirmedCandidates.length === 0 && hasGeneralClinicalReferenceEvidence(input)) {
    return { ...generalClinicalReferenceSite, candidates };
  }

  return {
    label: selected?.label ?? null,
    short_label: selected?.short_label ?? null,
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

function countPatternMatches(text: string, pattern: RegExp) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
}

function hasRuleEvidence(rule: SmartFacetRule, strongText: string, bodyText: string) {
  if (rule.strong.some((pattern) => pattern.test(strongText))) return true;
  if (!rule.body?.length) return false;
  const bodyMatches = rule.body.reduce((count, pattern) => count + countPatternMatches(bodyText, pattern), 0);
  return bodyMatches >= (rule.minBodyMatches ?? 2);
}

function addFacet(
  facets: DocumentOrganizationProfile["secondary_facets"],
  labelType: keyof DocumentOrganizationProfile["secondary_facets"],
  label: string,
) {
  if (facets[labelType].includes(label)) return;
  if (facets[labelType].length >= secondaryFacetLimits[labelType]) return;
  facets[labelType].push(label);
}

function secondaryFacets(rawTags: string[], titleText: string, sourceText: string, contentText: string) {
  const facets = emptySecondaryFacets();
  for (const rawTag of rawTags) {
    const facet = secondaryTagMap.get(normalizeText(rawTag));
    if (!facet) continue;
    addFacet(facets, facet.label_type, facet.label);
  }

  const strongText = `${titleText} ${sourceText} ${rawTags.join(" ")}`.slice(0, 25_000);
  const bodyText = contentText.slice(0, 80_000);

  for (const rule of smartFacetRules) {
    if (!hasRuleEvidence(rule, strongText, bodyText)) continue;
    addFacet(facets, rule.label_type, rule.label);
  }

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
    [Exclude<DocumentLabelType, "site" | "document_type" | "custom">, string[]]
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
  const site_confident = Boolean(site.label);
  const review_status = type_confident && site_confident ? "confident" : "needs_review";

  const profile: DocumentOrganizationProfile = {
    canonical_display_title: canonicalDocumentDisplayTitle(input),
    raw_bracket_tags,
    site,
    document_type,
    secondary_facets: secondaryFacets(
      raw_bracket_tags,
      `${input.title} ${input.file_name}`,
      input.source_path ?? "",
      `${input.contentText ?? ""} ${input.summaryText ?? ""}`,
    ),
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
