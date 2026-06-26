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
  {
    canonical: "Fiona Stanley Hospital",
    rawTags: ["fsh", "fh"],
    kind: "hospital",
    evidence: [/\bfiona stanley\b/i, /\bfsh\b/i, /\bfremantle hospital\b/i],
  },
  {
    canonical: "East Metropolitan Health Service",
    rawTags: ["emhs policy", "emhs"],
    kind: "health_service",
    evidence: [/\beast metropolitan health service\b/i, /\bemhs\b/i],
  },
  {
    canonical: "South Metropolitan Health Service",
    rawTags: ["smhs policy", "smhs"],
    kind: "health_service",
    evidence: [/\bsouth metropolitan health service\b/i, /\bsmhs\b/i],
  },
  {
    canonical: "Rockingham Peel Group",
    rawTags: ["rkpg", "rockingham peel group"],
    kind: "health_service",
    evidence: [/\brockingham peel\b/i, /\brkpg\b/i],
  },
  {
    canonical: "Child and Adolescent Mental Health Service",
    rawTags: ["camhs"],
    kind: "program",
    evidence: [/\bchild and adolescent mental health\b/i, /\bcamhs\b/i],
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
  { label: "procedure", confidence: 0.88, patterns: [/\bprocedure\b/i, /\bprocedural\b/i] },
  { label: "guideline", confidence: 0.84, patterns: [/\bguideline\b/i, /\bguidance\b/i] },
  { label: "protocol", confidence: 0.84, patterns: [/\bprotocol\b/i] },
  { label: "form", confidence: 0.82, patterns: [/\bform\b/i, /\brequest\b/i, /\breferral\b/i] },
  { label: "checklist", confidence: 0.82, patterns: [/\bchecklist\b/i] },
  { label: "pathway", confidence: 0.82, patterns: [/\bpathway\b/i, /\bflowchart\b/i] },
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
  const text = [
    input.title,
    input.file_name,
    input.source_path ?? "",
    input.summaryText ?? "",
    input.contentText ?? "",
    metadataString(input.metadata, "source_type"),
    metadataString(input.metadata, "category"),
  ].join(" ");
  const matched = documentTypePatterns.find((candidate) => candidate.patterns.some((pattern) => pattern.test(text)));
  if (!matched) return { label: "unknown", confidence: 0.2, evidence_sources: [] };
  return { label: matched.label, confidence: matched.confidence, evidence_sources: [`pattern:${matched.label}`] };
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
  const review_status = site.label || site.candidates.length === 0 ? "confident" : "needs_review";
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
