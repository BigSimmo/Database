import { loadEnvConfig } from "@next/env";
import type { Json } from "@/lib/supabase/database.types";

loadEnvConfig(process.cwd());

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  source_path: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
};

type QualityRow = {
  document_id: string;
  quality_score: number | null;
  extraction_quality: string | null;
  issues: unknown;
};

type PageRow = {
  document_id: string;
  page_number: number;
  text: string;
};

type DerivedMetadata = {
  metadata: Record<string, unknown>;
  changedKeys: string[];
};

type ClinicalValidationEvidence = {
  status: "unverified" | "locally_reviewed" | "approved";
  basis: string;
  evidence_type: string;
  evidence_text: string | null;
};

const APPLY = process.argv.includes("--apply");
const EVAL_ONLY = process.argv.includes("--eval-only");
const BACKFILL_VERSION = "source_metadata_backfill_2026_06_30_v1";

function backfillAsOfDate() {
  const index = process.argv.indexOf("--as-of");
  if (index < 0) return new Date();
  const raw = process.argv[index + 1];
  if (!raw || raw.startsWith("--")) throw new Error("Missing value for --as-of");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00+08:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid --as-of date: ${raw}`);
  return date;
}

const NOW = backfillAsOfDate();

const publisherByCode: Record<string, { publisher: string; jurisdiction: string }> = {
  AKG: { publisher: "Armadale Kalamunda Group", jurisdiction: "Australia/WA" },
  BMJ: { publisher: "BMJ Best Practice", jurisdiction: "International" },
  CAMHS: { publisher: "Child and Adolescent Mental Health Service", jurisdiction: "Australia/WA" },
  EMHS: { publisher: "East Metropolitan Health Service", jurisdiction: "Australia/WA" },
  FSH: { publisher: "Fiona Stanley Fremantle Hospitals Group", jurisdiction: "Australia/WA" },
  FSFH: { publisher: "Fiona Stanley Fremantle Hospitals Group", jurisdiction: "Australia/WA" },
  FSFHG: { publisher: "Fiona Stanley Fremantle Hospitals Group", jurisdiction: "Australia/WA" },
  KEMH: { publisher: "King Edward Memorial Hospital", jurisdiction: "Australia/WA" },
  KEMHS: { publisher: "King Edward Memorial Hospital", jurisdiction: "Australia/WA" },
  NMHS: { publisher: "North Metropolitan Health Service", jurisdiction: "Australia/WA" },
  PHC: { publisher: "Peel Health Campus", jurisdiction: "Australia/WA" },
  RKPG: { publisher: "Rockingham Peel Group", jurisdiction: "Australia/WA" },
  RPBG: { publisher: "Royal Perth Bentley Group", jurisdiction: "Australia/WA" },
  SMHS: { publisher: "South Metropolitan Health Service", jurisdiction: "Australia/WA" },
};

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function publisherCodeFor(document: DocumentRow, text = "") {
  const haystack = `${document.file_name} ${document.title} ${document.source_path ?? ""}`;
  const parentheticalCodes = [...haystack.matchAll(/\(([A-Z]{2,8})\)/g)].map((match) => match[1]);
  for (const code of parentheticalCodes) {
    if (publisherByCode[code]) return code;
  }
  for (const code of Object.keys(publisherByCode).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`(?:^|[\\\\/\\s])${code}(?:[\\\\/\\s]|$)`, "i").test(haystack)) return code;
  }
  if (/\bBM[J)]\s+Best\s+Practice\b/i.test(text) || /\bStraight\s+to\s+the\s+point\s+of\s+care\b/i.test(text)) {
    return "BMJ";
  }
  return null;
}

function sourceTypeFor(document: DocumentRow, text: string) {
  const haystack = `${document.title} ${document.file_name} ${text.slice(0, 1500)}`.toLowerCase();
  if (haystack.includes("standard operational procedure") || /\bsop\b/.test(haystack))
    return "standard_operating_procedure";
  if (haystack.includes("policy and procedure")) return "policy_procedure";
  if (/\bprocedure\b/.test(haystack)) return "procedure";
  if (/\bpolicy\b/.test(haystack)) return "policy";
  if (/\bguideline\b/.test(haystack)) return "guideline";
  if (/\bshared care\b/.test(haystack)) return "shared_care_guideline";
  if (/\bform\b|\bchart\b|\bplan\b/.test(haystack)) return "form_or_plan";
  if (publisherCodeFor(document, text) === "BMJ") return "clinical_reference";
  return "document";
}

function categoryFor(document: DocumentRow) {
  const haystack = `${document.title} ${document.file_name} ${document.source_path ?? ""}`.toLowerCase();
  if (haystack.includes("clozapine")) return "clozapine";
  if (haystack.includes("agitation") || haystack.includes("arousal")) return "agitation_arousal";
  if (haystack.includes("safety plan") || haystack.includes("safety planning")) return "safety_planning";
  if (haystack.includes("emergency department") || /\bed\b/.test(haystack)) return "emergency_department";
  if (haystack.includes("psychiatry") || haystack.includes("mental health") || haystack.includes("schizophrenia")) {
    return "mental_health";
  }
  if (haystack.includes("medical")) return "medical";
  return "general";
}

const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseClinicalDate(raw: string, options: { endOfMonth?: boolean } = {}) {
  const value = raw.trim().replace(/[,;]/g, "");
  let match = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  match = value.match(/\b(\d{1,2})[/-](20\d{2})\b/);
  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);
    const day = options.endOfMonth ? lastDayOfMonth(year, month) : 1;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  match = value.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i,
  );
  if (match) {
    const month = monthNumbers[match[1].toLowerCase()];
    const year = Number(match[2]);
    const day = options.endOfMonth ? lastDayOfMonth(year, month) : 1;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  match = value.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s+(20\d{2})\b/i,
  );
  if (match) {
    const month = monthNumbers[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = Number(match[3]);
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  match = value.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i,
  );
  if (match) {
    const day = Number(match[1]);
    const month = monthNumbers[match[2].toLowerCase()];
    const year = Number(match[3]);
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return null;
}

function firstMatchDate(text: string, labels: string[], endOfMonth: boolean) {
  const datePattern =
    "([0-3]?\\d[/-][01]?\\d[/-]20\\d{2}|[01]?\\d[/-]20\\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+[0-3]?\\d,?\\s+20\\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+20\\d{2}|[0-3]?\\d\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+20\\d{2})";
  const labelSeparator = "[\\s:;,*()\\-]*";
  for (const label of labels) {
    const pattern = new RegExp(`${label}${labelSeparator}${datePattern}`, "i");
    const match = text.match(pattern);
    if (match) {
      const parsed = parseClinicalDate(match[1], { endOfMonth });
      if (parsed) return { date: parsed, raw: normalizeWhitespace(match[0]) };
    }

    if (/^(?:Review Due|Revision Due|Revision Date|Next Review|Review Date)$/i.test(label)) {
      const monthThenYearPattern = new RegExp(
        `${label}[\\s\\S]{0,100}?\\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\b[\\s\\S]{0,50}?\\b(20\\d{2})\\b`,
        "i",
      );
      const monthThenYearMatch = text.match(monthThenYearPattern);
      if (monthThenYearMatch) {
        const parsed = parseClinicalDate(`${monthThenYearMatch[1]} ${monthThenYearMatch[2]}`, { endOfMonth });
        if (parsed) return { date: parsed, raw: normalizeWhitespace(monthThenYearMatch[0]) };
      }
    }

    if (
      /^(?:Review Due|Revision Due|Revision Date|Next Review|Review Date|Last Reviewed|Authorisation date|Published date|First Issued|Approved by|Endorsed by|Authorised by)$/i.test(
        label,
      )
    ) {
      const nearLabelPattern = new RegExp(`${label}[\\s\\S]{0,120}?${datePattern}`, "i");
      const nearLabelMatch = text.match(nearLabelPattern);
      if (nearLabelMatch) {
        const parsed = parseClinicalDate(nearLabelMatch[1], { endOfMonth });
        if (parsed) return { date: parsed, raw: normalizeWhitespace(nearLabelMatch[0]) };
      }
    }

    if (/^(?:Review Due|Revision Due|Revision Date|Review Date)$/i.test(label)) {
      const labelIndex = text.toLowerCase().indexOf(label.toLowerCase());
      if (labelIndex >= 0) {
        const window = text.slice(labelIndex, labelIndex + 320);
        const dateMatches = [...window.matchAll(new RegExp(datePattern, "gi"))];
        const last = dateMatches.at(-1);
        if (last?.[1]) {
          const parsed = parseClinicalDate(last[1], { endOfMonth });
          if (parsed) return { date: parsed, raw: normalizeWhitespace(`${label} ${last[1]}`) };
        }
      }
    }
    if (/^Revision Due$/i.test(label)) {
      const fuzzyHeader = text.match(/\bRevision\b[\s\S]{0,120}\bdue\b/i);
      if (fuzzyHeader?.index !== undefined) {
        const window = text.slice(fuzzyHeader.index, fuzzyHeader.index + 320);
        const dateMatches = [...window.matchAll(new RegExp(datePattern, "gi"))];
        const first = dateMatches[0];
        if (first?.[1]) {
          const parsed = parseClinicalDate(first[1], { endOfMonth });
          if (parsed) return { date: parsed, raw: normalizeWhitespace(`Revision due ${first[1]}`) };
        }
      }
    }
  }
  return null;
}

function standaloneReviewDate(text: string) {
  const datePattern =
    "([0-3]?\\d[/-][01]?\\d[/-]20\\d{2}|[01]?\\d[/-]20\\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+[0-3]?\\d,?\\s+20\\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+20\\d{2}|[0-3]?\\d\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+20\\d{2})";
  const reviewedThenReview = text.match(
    new RegExp(`\\bReviewed\\s+${datePattern}[\\s\\S]{0,100}?\\bReview\\s+${datePattern}`, "i"),
  );
  if (reviewedThenReview?.[2]) {
    const parsed = parseClinicalDate(reviewedThenReview[2], { endOfMonth: true });
    if (parsed) return { date: parsed, raw: normalizeWhitespace(reviewedThenReview[0]) };
  }

  const review = text.match(new RegExp(`\\bReview\\s*[:,]?\\s*${datePattern}`, "i"));
  if (review?.[1]) {
    const parsed = parseClinicalDate(review[1], { endOfMonth: true });
    if (parsed) return { date: parsed, raw: normalizeWhitespace(review[0]) };
  }

  return null;
}

function extractDates(text: string) {
  const review =
    firstMatchDate(text, ["Review Due", "Revision Due", "Revision Date", "Review Date", "Next Review"], true) ??
    standaloneReviewDate(text);
  const publication =
    firstMatchDate(
      text,
      [
        "Authorisation date",
        "Published date",
        "First Issued",
        "Date Compiled",
        "Date of Issue",
        "Date First Issued",
        "Issue Date",
        "Last updated",
        "Last Reviewed",
        "Authorised by",
        "Approved by",
        "Endorsed by",
        "Endorsed",
      ],
      false,
    ) ?? null;
  const lastUpdated = firstMatchDate(text, ["Last updated", "Updated"], false);
  const reviewCycle =
    /\b(?:reviewed|evaluated)[^.]{0,120}\bat least every three\s*(?:\(\s*3\s*\)|3)?\s*years?\b/i.test(text) ||
    /\bat least every three\s*(?:\(\s*3\s*\)|3)?\s*years?\b/i.test(text);
  const reviewSource = publication ?? lastUpdated;
  if (!review && reviewCycle && reviewSource?.date) {
    const inferred = new Date(`${reviewSource.date}T00:00:00+08:00`);
    inferred.setFullYear(inferred.getFullYear() + 3);
    return {
      review: {
        date: `${inferred.getFullYear()}-${pad(inferred.getMonth() + 1)}-${pad(inferred.getDate())}`,
        raw: `inferred from explicit three-year review cycle and ${reviewSource.raw}`,
      },
      publication,
      lastUpdated,
    };
  }
  return { review, publication, lastUpdated };
}

function documentStatusFor(dates: ReturnType<typeof extractDates>, publisherCode: string | null) {
  if (dates.review?.date) {
    return new Date(`${dates.review.date}T23:59:59+08:00`) >= NOW ? "current" : "review_due";
  }
  if (publisherCode === "BMJ" && dates.lastUpdated?.date) {
    const updated = new Date(`${dates.lastUpdated.date}T00:00:00+08:00`);
    const threeYearsAgo = new Date(NOW);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    return updated >= threeYearsAgo ? "current" : "review_due";
  }
  return "unknown";
}

function validationSnippet(text: string, pattern: RegExp) {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return null;
  const start = Math.max(0, match.index - 90);
  const end = Math.min(text.length, match.index + match[0].length + 180);
  return normalizeWhitespace(text.slice(start, end));
}

function clinicalValidationEvidenceFor(args: {
  publisherCode: string | null;
  text: string;
  existing: string;
}): ClinicalValidationEvidence {
  if (args.existing === "approved") {
    return {
      status: "approved",
      basis: "pre-existing approved status preserved",
      evidence_type: "manual_approved_status",
      evidence_text: null,
    };
  }
  if (!args.publisherCode || publisherByCode[args.publisherCode]?.jurisdiction !== "Australia/WA") {
    return {
      status: "unverified",
      basis: "not a local WA source",
      evidence_type: "none",
      evidence_text: null,
    };
  }

  const evidencePatterns: Array<{ type: string; pattern: RegExp }> = [
    {
      type: "committee_endorsement",
      pattern:
        /\b(?:committee\/consumer\s+endorsed\s+by|endorsed\s+by|endorsed)\b[\s\S]{0,260}\b(?:committee|clinical|governance|safety|quality|risk|drug|therapeutics|executive|service\s+director|director|co-?director|nurse\s+director|medical\s+director|head\s+of\s+department|HOD|NUM|CNC|CN|consultant|physiotherapy|pharmacy|haematology|respiratory|transfusion|commissioning|assurance|group|DONM|DCS|CPC|HoLAA)\b/i,
    },
    {
      type: "committee_approval",
      pattern:
        /\b(?:approved\s+by|approval\s+by|approved)\b[\s\S]{0,260}\b(?:committee|clinical|governance|safety|quality|risk|drug|therapeutics|executive|service\s+director|director|co-?director|nurse\s+director|medical\s+director|head\s+of\s+department|HOD|NUM|CNC|CN|consultant|physiotherapy|pharmacy|haematology|respiratory|transfusion|commissioning|assurance|group|DONM|DCS|CPC|HoLAA)\b/i,
    },
    {
      type: "authorisation",
      pattern:
        /\b(?:authorisation|authorised\s+by|authorized\s+by|executive\s+sponsor)\b[\s\S]{0,300}\b(?:committee|clinical|governance|safety|quality|risk|drug|therapeutics|executive|service\s+director|director|co-?director|nurse\s+director|medical\s+director|head\s+of\s+department|HOD|NUM|CNC|CN|consultant|physiotherapy|pharmacy|haematology|respiratory|transfusion|sponsor|commissioning|assurance|group|DONM|DCS|CPC|HoLAA)\b/i,
    },
    {
      type: "policy_sponsor",
      pattern:
        /\b(?:policy\s+sponsor|executive\s+sponsor)\b[\s\S]{0,220}\b(?:director|co-?director|nurse\s+director|medical\s+director|clinical|medical|nursing|mental\s+health|service)\b/i,
    },
    {
      type: "document_control_owner",
      pattern:
        /\b(?:document\s+owner|policy\s+owner|procedure\s+owner)\b[\s\S]{0,180}\b(?:clinical|medical|nursing|pharmacy|mental\s+health|service|director|committee|head\s+of\s+department|HOD|NUM|CNC|CN|consultant|physiotherapy|haematology|respiratory|transfusion)\b/i,
    },
  ];

  for (const { type, pattern } of evidencePatterns) {
    const evidence = validationSnippet(args.text, pattern);
    if (evidence) {
      return {
        status: "locally_reviewed",
        basis: `local WA source with document-control ${type.replace(/_/g, " ")} evidence`,
        evidence_type: type,
        evidence_text: evidence,
      };
    }
  }

  return {
    status: "unverified",
    basis: "no local document-control approval or endorsement evidence found",
    evidence_type: "none",
    evidence_text: null,
  };
}

function extractionQualityFor(quality: QualityRow | undefined, existing: string) {
  const qualityValue = quality?.extraction_quality;
  const score = typeof quality?.quality_score === "number" ? quality.quality_score : null;
  const issues = Array.isArray(quality?.issues) ? quality.issues.map(String).join(" ") : String(quality?.issues ?? "");
  if (qualityValue === "poor" || (score !== null && score < 0.52)) return "poor";
  if (
    qualityValue === "good" &&
    (score === null || score >= 0.72) &&
    !/\b(?:failed|ocr|missing text)\b/i.test(issues)
  ) {
    return "good";
  }
  if (qualityValue === "partial" || qualityValue === "good" || (score !== null && score >= 0.52)) return "partial";
  return existing || "unknown";
}

function metadataValuesEqual(left: unknown, right: unknown) {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;
  if (left === null || right === null) return left === right;
  if (typeof left !== "object" || typeof right !== "object") return false;
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function setIfChanged(metadata: Record<string, unknown>, key: string, value: unknown, changed: string[]) {
  if (value === undefined || value === null || value === "") return;
  if (metadataValuesEqual(metadata[key], value)) return;
  metadata[key] = value;
  changed.push(key);
}

function deriveMetadata(document: DocumentRow, text: string, quality: QualityRow | undefined): DerivedMetadata {
  const metadata = metadataRecord(document.metadata);
  const changedKeys: string[] = [];
  const publisherCode = publisherCodeFor(document, text);
  const publisher = publisherCode ? publisherByCode[publisherCode] : null;
  const extractedDates = extractDates(text);
  const dates = publisherCode === "BMJ" ? { ...extractedDates, review: null } : extractedDates;
  const documentStatus = documentStatusFor(dates, publisherCode);
  const existingValidation = String(metadata.clinical_validation_status ?? "unverified");
  const clinicalValidation = clinicalValidationEvidenceFor({
    publisherCode,
    text,
    existing: existingValidation,
  });
  const clinicalValidationStatus = clinicalValidation.status;
  const extractionQuality = extractionQualityFor(quality, String(metadata.extraction_quality ?? "unknown"));

  setIfChanged(metadata, "source_title", titleWithoutExtension(document.file_name), changedKeys);
  setIfChanged(metadata, "publisher_code", publisherCode, changedKeys);
  setIfChanged(metadata, "publisher", publisher?.publisher, changedKeys);
  setIfChanged(metadata, "jurisdiction", publisher?.jurisdiction, changedKeys);
  setIfChanged(metadata, "source_type", sourceTypeFor(document, text), changedKeys);
  setIfChanged(metadata, "category", categoryFor(document), changedKeys);
  setIfChanged(metadata, "publication_date", dates.publication?.date, changedKeys);
  setIfChanged(metadata, "review_date", dates.review?.date, changedKeys);
  setIfChanged(metadata, "document_status", documentStatus, changedKeys);
  setIfChanged(metadata, "clinical_validation_status", clinicalValidationStatus, changedKeys);
  setIfChanged(
    metadata,
    "clinical_validation_evidence",
    {
      status: clinicalValidation.status,
      basis: clinicalValidation.basis,
      evidence_type: clinicalValidation.evidence_type,
      evidence_text: clinicalValidation.evidence_text,
    },
    changedKeys,
  );
  setIfChanged(metadata, "extraction_quality", extractionQuality, changedKeys);
  setIfChanged(metadata, "source_metadata_backfill_version", BACKFILL_VERSION, changedKeys);
  setIfChanged(
    metadata,
    "source_metadata_backfill_basis",
    {
      publisher: publisherCode ? "filename/source_path code" : "not inferred",
      document_status: dates.review?.raw ?? dates.lastUpdated?.raw ?? "not inferred",
      publication_date: dates.publication?.raw ?? "not inferred",
      clinical_validation_status: clinicalValidation.basis,
      extraction_quality: quality
        ? `document_index_quality:${quality.extraction_quality ?? "unknown"} score:${quality.quality_score ?? "unknown"}`
        : "existing metadata",
    },
    changedKeys,
  );
  if (changedKeys.length > 0) {
    metadata.source_metadata_backfilled_at = new Date().toISOString();
    changedKeys.push("source_metadata_backfilled_at");
  }

  return { metadata, changedKeys };
}

async function loadAllDocuments() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const documents: DocumentRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("documents")
      .select("id,title,file_name,source_path,metadata,status")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    documents.push(...((data ?? []) as DocumentRow[]));
    if (!data || data.length < pageSize) break;
  }
  return documents;
}

async function loadQualityRows() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const rows: QualityRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("document_index_quality")
      .select("document_id,quality_score,extraction_quality,issues")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as QualityRow[]));
    if (!data || data.length < pageSize) break;
  }
  return new Map(rows.map((row) => [row.document_id, row]));
}

async function loadPageText(documentIds: string[]) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const textByDocument = new Map<string, string>();
  const pageSize = 1000;
  for (let index = 0; index < documentIds.length; index += 100) {
    const batch = documentIds.slice(index, index + 100);
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("document_pages")
        .select("document_id,page_number,text")
        .in("document_id", batch)
        .order("document_id", { ascending: true })
        .order("page_number", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      for (const row of (data ?? []) as PageRow[]) {
        textByDocument.set(row.document_id, `${textByDocument.get(row.document_id) ?? ""}\n${row.text}`);
      }
      if (!data || data.length < pageSize) break;
    }
  }
  return textByDocument;
}

async function evalDocumentIds() {
  if (!EVAL_ONLY) return null;
  const { readFileSync } = await import("node:fs");
  const report = JSON.parse(readFileSync("output/evals/retrieval-quality-2026-06-30T09-18-10-598Z.json", "utf8")) as {
    retrieval?: { results?: Array<{ topResults?: Array<{ file_name: string }> }> };
  };
  const topFiles = new Set<string>();
  for (const result of report.retrieval?.results ?? []) {
    for (const top of result.topResults ?? []) topFiles.add(top.file_name);
  }
  return topFiles;
}

async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const [documents, qualityByDocument, evalFiles] = await Promise.all([
    loadAllDocuments(),
    loadQualityRows(),
    evalDocumentIds(),
  ]);
  const targetDocuments = evalFiles ? documents.filter((document) => evalFiles.has(document.file_name)) : documents;
  const pageText = await loadPageText(targetDocuments.map((document) => document.id));
  const derived = targetDocuments.map((document) => {
    const text = normalizeWhitespace(pageText.get(document.id) ?? "");
    return {
      document,
      ...deriveMetadata(document, text, qualityByDocument.get(document.id)),
    };
  });
  const changed = derived.filter((item) => item.changedKeys.length > 0);

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    scope: EVAL_ONLY ? "eval-top-result-documents" : "all-documents",
    documents_seen: targetDocuments.length,
    documents_with_changes: changed.length,
    status_counts: changed.reduce<Record<string, number>>((counts, item) => {
      const key = `${item.metadata.document_status}/${item.metadata.clinical_validation_status}/${item.metadata.extraction_quality}`;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    changed_key_counts: changed.reduce<Record<string, number>>((counts, item) => {
      for (const key of item.changedKeys) counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    sample: changed.slice(0, 20).map((item) => ({
      title: item.document.title,
      file_name: item.document.file_name,
      changed_keys: item.changedKeys,
      document_status: item.metadata.document_status,
      clinical_validation_status: item.metadata.clinical_validation_status,
      extraction_quality: item.metadata.extraction_quality,
      publisher: item.metadata.publisher,
      publication_date: item.metadata.publication_date,
      review_date: item.metadata.review_date,
      basis: item.metadata.source_metadata_backfill_basis,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) return;

  for (const item of changed) {
    const { error } = await supabase
      .from("documents")
      .update({ metadata: item.metadata as Json })
      .eq("id", item.document.id);
    if (error) throw new Error(`Failed to update ${item.document.file_name}: ${error.message}`);
  }
  console.log(`Applied source metadata backfill to ${changed.length} documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
