/** Unknown / empty catalog tokens that must never surface in UI copy. */
const UNKNOWN_FIELD =
  /^(?:not publicly stated|not applicable|none|none listed|not listed|n\/a|na|unknown|tbd|confirm locally|cost not publicly stated)$/i;

/** Labeled prefixes commonly glued into merged catalogue blobs. */
const LABELED_PREFIX =
  /^(?:contact|referral pathway|hours|cost\s*\/\s*funding|cost|eligibility|patient group|provider|region|exclusions?|discharge planning)\s*:\s*/i;

export type CompactCatalogFieldOptions = {
  /** Max characters for the returned phrase (ellipsis when truncated). */
  maxLength?: number;
};

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripLabeledPrefix(value: string) {
  return value.replace(LABELED_PREFIX, "").trim();
}

function isUnknownToken(value: string) {
  return !value || UNKNOWN_FIELD.test(value);
}

/**
 * Compact pipe/newline-joined catalogue paraphrases into one short display phrase.
 * Splits, strips labeled prefixes, drops unknowns, dedupes exact and near-duplicates,
 * keeps the first remaining clause, and truncates to maxLength.
 */
export function compactCatalogField(
  text: string | null | undefined,
  maxLengthOrOptions: number | CompactCatalogFieldOptions = 120,
): string {
  const maxLength = typeof maxLengthOrOptions === "number" ? maxLengthOrOptions : (maxLengthOrOptions.maxLength ?? 120);
  const raw = text?.trim() ?? "";
  if (!raw) return "";

  const parts = raw
    .split(/[|\n\r]+/)
    .map((line) => stripLabeledPrefix(line.trim()))
    .filter((line) => line.length > 0 && !isUnknownToken(line));

  const unique: string[] = [];
  for (const part of parts) {
    const key = normalizeKey(part);
    if (!key) continue;
    if (unique.some((entry) => normalizeKey(entry) === key)) continue;
    unique.push(part);
  }

  // Collapse near-duplicates by containment, keeping the longer/more informative
  // clause so short tokens like "Phone" or "Free" do not eclipse fuller phrases.
  const kept: { raw: string; key: string }[] = [];
  for (const part of unique) {
    const key = normalizeKey(part);
    if (kept.some((entry) => entry.key.includes(key) && entry.key.length >= key.length)) {
      continue;
    }
    for (let index = kept.length - 1; index >= 0; index -= 1) {
      const existing = kept[index];
      if (key.includes(existing.key) && key.length > existing.key.length) {
        kept.splice(index, 1);
      }
    }
    kept.push({ raw: part, key });
  }

  const primary = kept[0]?.raw ?? stripLabeledPrefix(raw);
  if (!primary || isUnknownToken(primary)) return "";
  if (primary.length <= maxLength) return primary;
  const truncated = primary.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return truncated ? `${truncated}…` : primary.slice(0, maxLength);
}

/** @deprecated Prefer compactCatalogField — kept as a thin alias for existing imports/tests. */
export function compactBestUseTitle(text: string, maxLength = 120): string {
  return compactCatalogField(text, maxLength);
}

export type LabeledReferralParts = {
  pathway?: string;
  contact?: string;
  hours?: string;
  cost?: string;
  provider?: string;
  region?: string;
  patientGroup?: string;
  other: string[];
};

const REFERRAL_LABEL_MAP: Record<string, keyof Omit<LabeledReferralParts, "other">> = {
  contact: "contact",
  "referral pathway": "pathway",
  hours: "hours",
  "cost/funding": "cost",
  cost: "cost",
  provider: "provider",
  region: "region",
  "patient group": "patientGroup",
};

/**
 * Split a referral_details blob into labeled segments so the UI can show
 * pathway / hours / cost as discrete rows instead of one pipe-joined paragraph.
 */
export function parseLabeledReferralDetails(text: string | null | undefined): LabeledReferralParts {
  const result: LabeledReferralParts = { other: [] };
  const raw = text?.trim() ?? "";
  if (!raw) return result;

  for (const line of raw
    .split(/[|\n\r]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const match = line.match(
      /^(contact|referral pathway|hours|cost\s*\/\s*funding|cost|provider|region|patient group)\s*:\s*(.+)$/i,
    );
    if (!match) {
      result.other.push(line);
      continue;
    }
    const labelKey = match[1]
      .toLowerCase()
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s+/g, " ");
    const field = REFERRAL_LABEL_MAP[labelKey];
    const value = match[2].trim();
    if (!field || isUnknownToken(value)) {
      result.other.push(line);
      continue;
    }
    const existing = result[field];
    result[field] = existing ? `${existing} | ${value}` : value;
  }

  return result;
}
