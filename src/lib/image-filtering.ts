import type { ExtractedImage, ImageEvidenceCategory } from "@/lib/types";

export const clinicalImagePolicyVersion = "clinical-image-use-v1" as const;

export type ClinicalImageUseClass =
  | "clinical_evidence"
  | "administrative"
  | "reference"
  | "decorative_or_empty"
  | "ambiguous";

export type CheapImageFilterInput = {
  bytesLength: number;
  imageHash: string;
  seenHashes: Set<string>;
  image: Pick<ExtractedImage, "bbox" | "height" | "width" | "sourceKind">;
};

export type ClassifiedImage = {
  image_type: ImageEvidenceCategory;
  searchable: boolean;
  clinical_relevance_score: number;
  skip_reason: string | null;
  clinical_use_class?: ClinicalImageUseClass;
  clinical_use_reason?: string | null;
  clinical_signal_score?: number;
  admin_signal_score?: number;
};

export type ImageUseAssessmentInput = {
  imageType?: ImageEvidenceCategory | string | null;
  searchable?: boolean | null;
  clinicalRelevanceScore?: number | null;
  sourceKind?: string | null;
  tableRole?: string | null;
  tableText?: string | null;
  tableTitle?: string | null;
  tableLabel?: string | null;
  caption?: string | null;
  labels?: string[] | null;
  skipReason?: string | null;
};

export type ImageUseAssessment = {
  clinical_use_class: ClinicalImageUseClass;
  clinical_use_reason: string;
  clinical_signal_score: number;
  admin_signal_score: number;
  searchable: boolean;
  clinical_relevance_score: number;
};

const clinicalEvidencePatterns = [
  /\bpatient(?:'s|s)?\b/i,
  /\bconsumer(?:'s|s)?\b/i,
  /\bassessment\b/i,
  /\bmanagement\b/i,
  /\bmonitor(?:ing|ed)?\b/i,
  /\bobservation(?:s)?\b/i,
  /\bmedication(?:s)?\b/i,
  /\bdose\b|\bmg\b|\bmcg\b|\bim\b|\bpo\b/i,
  /\bthreshold\b|\bscore\b|\brating\b|\bscale\b|\brange\b/i,
  /\brisk\b|\bred flag\b|\bescalat\w*\b|\burgent\b|\bemergency\b/i,
  /\btreatment\b|\btherapy\b|\bprocedure\b|\bintervention\b/i,
  /\bcontraindicat\w*\b|\bside effect\b|\badverse\b|\btoxicity\b/i,
  /\bclozapine\b|\blithium\b|\bbenzodiazepine\b|\bantipsychotic\b|\bect\b/i,
  /\bworkflow\b|\bpathway\b|\bstep\s+\d+\b|\brefer(?:ral)?\b/i,
  /\bresponsib\w*\b(?=.*\b(?:patient|consumer|clinical|monitor|medication|dose|risk|escalat|assessment|treatment)\b)/i,
];

const adminPatterns = [
  /\bauthori[sz]ed by\b/i,
  /\bauthori[sz]ation date\b/i,
  /\bpublished date\b/i,
  /\bversion\b/i,
  /\beffective from\b/i,
  /\beffective to\b/i,
  /\bamendment(?:\(s\))?\b/i,
  /\bdocument owner\b/i,
  /\bapproval\b|\bapproved by\b|\bendorsed\b/i,
  /\breview date\b|\bnext review\b|\bsuperseded\b/i,
  /\bsite\b(?=.*\boperational area\b)(?=.*\bapplicable to\b)/i,
  /\boperational area\b/i,
  /\bapplicable to\b/i,
  /\bpolicy sponsor\b|\bcontact person\b/i,
];

const referencePatterns = [
  /\breferences\b/i,
  /\bbibliography\b/i,
  /\blegislation\b/i,
  /\brelevant standards\b/i,
  /\bassociated documents\b/i,
  /\bdocuments support\b/i,
];

const noisyTablePatterns = [
  /\b(?:page|version|review date|document owner|authori[sz]ed by|effective from|amendment|copyright)\b/i,
  /^[\W\d\s|:;.,/-]+$/,
];

function combinedText(input: ImageUseAssessmentInput) {
  return [input.tableRole, input.tableLabel, input.tableTitle, input.tableText, input.caption, ...(input.labels ?? [])]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function countPatternHits(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function clampedScore(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(number, 0), 1) : fallback;
}

function normalizedTableTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function lowSignalImageTextSkipReason(input: {
  sourceKind?: string | null;
  tableText?: string | null;
  tableTitle?: string | null;
  tableLabel?: string | null;
  tableRole?: string | null;
  width?: number | null;
  height?: number | null;
}) {
  const text = [input.tableTitle, input.tableLabel, input.tableText].filter(Boolean).join(" ");
  const tokens = normalizedTableTokens(text);
  const uniqueRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const clinicalHits = countPatternHits(text, clinicalEvidencePatterns);
  const adminHits = countPatternHits(text, adminPatterns) + countPatternHits(text, referencePatterns);
  const shortestSide = input.width && input.height ? Math.min(input.width, input.height) : null;
  const sourceKind = input.sourceKind ?? "";
  const tableRole = String(input.tableRole ?? "").toLowerCase();

  if (sourceKind === "table_crop" && tableRole === "admin" && clinicalHits < 2) {
    return "administrative table without clinical facts";
  }
  if (sourceKind === "table_crop" && tokens.length < 8 && clinicalHits === 0) {
    return "low text table crop";
  }
  if (sourceKind === "table_crop" && tokens.length >= 12 && uniqueRatio < 0.34 && clinicalHits < 2) {
    return "repetitive noisy table OCR";
  }
  if (
    sourceKind === "table_crop" &&
    noisyTablePatterns.some((pattern) => pattern.test(text)) &&
    adminHits > clinicalHits
  ) {
    return "document-control table OCR";
  }
  if (sourceKind !== "table_crop" && shortestSide !== null && shortestSide < 96 && clinicalHits === 0) {
    return "small low-signal visual";
  }
  return null;
}

function reasonForClass(useClass: ClinicalImageUseClass, clinicalScore: number, adminScore: number) {
  if (useClass === "clinical_evidence")
    return `clinical signals=${clinicalScore}; admin/reference signals=${adminScore}`;
  if (useClass === "administrative") return `document-control/admin table signals=${adminScore}`;
  if (useClass === "reference") return "reference or bibliography material";
  if (useClass === "decorative_or_empty") return "decorative, empty, or explicitly non-searchable image";
  return `ambiguous image evidence; clinical signals=${clinicalScore}; admin/reference signals=${adminScore}`;
}

export function assessClinicalImageUse(input: ImageUseAssessmentInput): ImageUseAssessment {
  const text = combinedText(input);
  const tableRole = String(input.tableRole ?? "").toLowerCase();
  const imageType = String(input.imageType ?? "");
  const sourceKind = String(input.sourceKind ?? "");
  const clinicalScore = countPatternHits(text, clinicalEvidencePatterns);
  const adminScore = countPatternHits(text, adminPatterns);
  const referenceScore = countPatternHits(text, referencePatterns);
  const modelScore = clampedScore(input.clinicalRelevanceScore, 0.4);
  const modelSearchable = input.searchable !== false;
  const lowSignalSkip = lowSignalImageTextSkipReason({
    sourceKind,
    tableRole,
    tableText: input.tableText,
    tableTitle: input.tableTitle,
    tableLabel: input.tableLabel,
  });

  let useClass: ClinicalImageUseClass = "ambiguous";
  if (lowSignalSkip && adminScore + referenceScore > clinicalScore) {
    useClass = "administrative";
  } else if (lowSignalSkip && clinicalScore < 2) {
    useClass = "decorative_or_empty";
  } else if (
    imageType === "logo_decorative" ||
    /logo|decorative|duplicate|tiny|header|footer|empty|small/i.test(input.skipReason ?? "")
  ) {
    useClass = "decorative_or_empty";
  } else if (tableRole === "reference" || (referenceScore > 0 && clinicalScore < 2)) {
    useClass = "reference";
  } else if (tableRole === "admin" || (adminScore >= 2 && clinicalScore < 2)) {
    useClass = "administrative";
  } else if (clinicalScore >= 2 && adminScore < 3) {
    useClass = "clinical_evidence";
  } else if (tableRole === "clinical" && clinicalScore >= 1) {
    useClass = "clinical_evidence";
  } else if (modelSearchable && modelScore >= 0.78 && adminScore === 0 && referenceScore === 0) {
    useClass = "clinical_evidence";
  } else if (sourceKind !== "table_crop" && modelSearchable && modelScore >= 0.72 && adminScore === 0) {
    useClass = "clinical_evidence";
  }

  const searchable = useClass === "clinical_evidence";
  return {
    clinical_use_class: useClass,
    clinical_use_reason: lowSignalSkip ?? reasonForClass(useClass, clinicalScore, adminScore + referenceScore),
    clinical_signal_score: clinicalScore,
    admin_signal_score: adminScore + referenceScore,
    searchable,
    clinical_relevance_score: searchable ? Math.max(modelScore, Math.min(0.95, 0.45 + clinicalScore * 0.1)) : 0,
  };
}

function safeMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function clinicalUseClassFromMetadata(metadata: unknown): ClinicalImageUseClass | null {
  const value = safeMetadata(metadata).clinical_use_class;
  return typeof value === "string" &&
    ["clinical_evidence", "administrative", "reference", "decorative_or_empty", "ambiguous"].includes(value)
    ? (value as ClinicalImageUseClass)
    : null;
}

export function isClinicalImageEvidence(image: {
  searchable?: boolean | null;
  image_type?: string | null;
  clinical_relevance_score?: number | null;
  clinicalUseClass?: string | null;
  tableRole?: string | null;
  source_kind?: string | null;
  sourceKind?: string | null;
  metadata?: unknown;
}) {
  if (image.searchable === false || image.image_type === "logo_decorative") return false;
  if (image.clinicalUseClass) return image.clinicalUseClass === "clinical_evidence";
  const metadata = safeMetadata(image.metadata);
  const useClass = clinicalUseClassFromMetadata(metadata);
  if (useClass) return useClass === "clinical_evidence";
  const assessment = assessClinicalImageUse({
    imageType: image.image_type,
    searchable: image.searchable,
    clinicalRelevanceScore: image.clinical_relevance_score,
    sourceKind: image.sourceKind ?? image.source_kind,
    tableRole: image.tableRole ?? (typeof metadata.table_role === "string" ? metadata.table_role : null),
    tableText:
      typeof metadata.table_text === "string"
        ? metadata.table_text
        : typeof metadata.table_text_snippet === "string"
          ? metadata.table_text_snippet
          : null,
  });
  return assessment.clinical_use_class === "clinical_evidence";
}

function bboxLooksLikeHeaderOrFooter(bbox: ExtractedImage["bbox"]) {
  if (!bbox) return false;
  const [, y0, , y1] = bbox;
  const height = Math.abs(y1 - y0);
  if (height > 110) return false;
  return y1 < 105 || y0 > 705;
}

export function cheapImageSkipReason(input: CheapImageFilterInput) {
  const { bytesLength, imageHash, image, seenHashes } = input;
  const sourceKind = image.sourceKind ?? "embedded";
  const width = image.width ?? null;
  const height = image.height ?? null;

  if (seenHashes.has(imageHash)) return "duplicate image";
  if (sourceKind === "embedded" && bytesLength < 4096) return "small decorative image";
  if (width && height) {
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    const aspectRatio = longestSide / Math.max(shortestSide, 1);

    if (sourceKind === "embedded" && bboxLooksLikeHeaderOrFooter(image.bbox)) {
      return "logo/header/footer placement";
    }
    if (sourceKind === "embedded" && shortestSide < 72) return "tiny icon or marker";
    if (sourceKind === "embedded" && aspectRatio > 12) return "extreme aspect ratio decorative image";
  }

  return null;
}

export function classifiedImageSkipReason(classification: ClassifiedImage) {
  if (classification.clinical_use_class && classification.clinical_use_class !== "clinical_evidence") {
    return classification.skip_reason ?? classification.clinical_use_reason ?? "not clinically useful evidence";
  }
  if (classification.image_type === "logo_decorative") return classification.skip_reason ?? "logo or decorative mark";
  if (!classification.searchable) return classification.skip_reason ?? "not clinically searchable";
  if (classification.clinical_relevance_score < 0.18) return classification.skip_reason ?? "low clinical relevance";
  return null;
}

function bytesFromHashInput(input: string | Uint8Array | ArrayBuffer) {
  if (typeof input === "string") return new TextEncoder().encode(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return input;
}

export function lightweightPerceptualHash(
  imageContent: string | Uint8Array | ArrayBuffer,
  width?: number | null,
  height?: number | null,
) {
  const bytes = bytesFromHashInput(imageContent);
  const sizeKey = `${width ?? "w"}x${height ?? "h"}`;
  if (bytes.length === 0) return `ph1:${sizeKey}:empty`;

  const bucketCount = 16;
  const buckets = new Array<number>(bucketCount).fill(0);
  const counts = new Array<number>(bucketCount).fill(0);
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  let sampleIndex = 0;

  for (let index = 0; index < bytes.length; index += step) {
    const bucket = sampleIndex % bucketCount;
    buckets[bucket] += bytes[index];
    counts[bucket] += 1;
    sampleIndex += 1;
  }

  const averages = buckets.map((sum, index) => sum / Math.max(counts[index], 1));
  const mean = averages.reduce((sum, value) => sum + value, 0) / bucketCount;
  const bitString = averages.map((value) => (value >= mean ? "1" : "0")).join("");
  const hex = Number.parseInt(bitString, 2).toString(16).padStart(4, "0");
  return `ph1:${sizeKey}:${hex}`;
}
