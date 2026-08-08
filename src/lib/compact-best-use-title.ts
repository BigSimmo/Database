/** Unknown / empty catalog tokens that must never surface in UI copy. */
const UNKNOWN_FIELD =
  /^(?:not publicly stated|not applicable|none|none listed|not listed|n\/a|na|unknown|tbd|confirm locally|cost not publicly stated)$/i;

/** Labeled prefixes commonly glued into merged catalogue blobs. */
const LABELED_PREFIX =
  /^(?:contact|referral pathway|hours|cost\s*\/\s*funding|cost|eligibility|patient group|provider|region|exclusions?|discharge planning)\s*:\s*/i;

/** Qualified placeholders that are longer than exact UNKNOWN_FIELD tokens. */
const PLACEHOLDER_PHRASE =
  /\b(?:not publicly stated|not (?:fully )?public(?:ly)?(?: available|ly stated)?|details? not (?:available|provided|listed)|not stated in (?:the )?public)\b/i;

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
 * True when a clause mainly asserts missing public info (or is a vague
 * meta-pathway) rather than giving an actionable referral/exclusion detail.
 */
export function isQualifiedPlaceholder(value: string): boolean {
  const key = normalizeKey(value);
  if (!key || isUnknownToken(key)) return true;

  if (/^service[- ]specific(?:\s+referral)?(?:\s+pathway)?$/i.test(key)) return true;
  if (/^see (?:the )?(?:service|provider|website|page)\b/i.test(key)) return true;
  if (/^refer to (?:the )?(?:service|provider|website)\b/i.test(key)) return true;

  const placeholderHit = PLACEHOLDER_PHRASE.exec(key);
  if (!placeholderHit) return false;

  const before = key
    .slice(0, placeholderHit.index)
    .trim()
    .replace(/[;:,.-]+$/g, "")
    .trim();
  if (!before || before.length < 8) return true;
  // Meta lead-ins like "referral details not publicly stated on …"
  if (
    /^(?:referral|contact|hours|cost|exclusion|details?|information|pathway|summary|public)\b/i.test(before) &&
    before.length < 40
  ) {
    return true;
  }
  return false;
}

/**
 * Compact pipe/newline-joined catalogue paraphrases into one short display phrase.
 * Splits, strips labeled prefixes, drops unknowns, ranks actionable clauses above
 * qualified placeholders, dedupes near-duplicates, keeps the first remaining clause,
 * and truncates to maxLength.
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

  const actionable = unique.filter((part) => !isQualifiedPlaceholder(part));
  // Prefer actionable clauses; if the blob is only qualified placeholders, omit rather
  // than promoting "not publicly stated…" as a route/criterion.
  if (actionable.length === 0) {
    return "";
  }

  // Collapse near-duplicates by containment, keeping the longer/more informative
  // clause so short tokens like "Phone" or "Free" do not eclipse fuller phrases.
  const kept: { raw: string; key: string }[] = [];
  for (const part of actionable) {
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

  const primary = kept[0]?.raw ?? "";
  if (!primary || isUnknownToken(primary) || isQualifiedPlaceholder(primary)) return "";
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
