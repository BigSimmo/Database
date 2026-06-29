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
  label_type: Extract<DocumentLabelType, "population" | "setting" | "service" | "topic" | "workflow">;
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
  ["adult", { label: "adult", label_type: "population" }],
  ["child", { label: "child", label_type: "population" }],
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
  return { population: [], setting: [], service: [], topic: [], workflow: [] };
}

function secondaryFacets(rawTags: string[]) {
  const facets = emptySecondaryFacets();
  for (const rawTag of rawTags) {
    const facet = secondaryTagMap.get(normalizeText(rawTag));
    if (!facet) continue;
    facets[facet.label_type].push(facet.label);
  }
  return {
    population: uniqueStrings(facets.population),
    setting: uniqueStrings(facets.setting),
    service: uniqueStrings(facets.service),
    topic: uniqueStrings(facets.topic),
    workflow: uniqueStrings(facets.workflow),
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
    [Exclude<DocumentLabelType, "site" | "document_type" | "medication" | "risk" | "custom">, string[]]
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
    secondary_facets: secondaryFacets(raw_bracket_tags),
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
