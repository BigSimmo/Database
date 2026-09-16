import draftData from "@/data/dictionary-sense-drafts.json";

/**
 * Dictionary sense drafts — the editorial layer, not the published dictionary.
 *
 * The published dictionary in `dictionary-data.ts` is term-first: one entry per
 * concept, with abbreviations hanging off it as aliases. The 2026-09 handover is
 * sense-first: one record per *meaning* of a token, so `BD` is two records rather
 * than one entry with an ambiguous alias. That difference is the whole point —
 * "BD" meaning bipolar disorder and "BD" meaning twice a day are not one thing
 * with two names, and a model that flattens them cannot warn about the collision.
 *
 * Nothing here is published. Every draft carries `clinicalApproval: "pending"` and
 * `publicationAllowed: false`, and `assertNoDraftIsPublished` is the gate that keeps
 * it that way. Promotion into `dictionary-data.ts` is a clinical sign-off decision
 * made per record by a named reviewer, not a data migration.
 */
export type DictionarySenseRecordType = "abbreviation" | "statutory_form" | "instrument_name" | "service_name";

/**
 * `name_checked` means only that the token and its expansion were verified against
 * the cited source. It is explicitly *not* a check of the surrounding clinical
 * prose, which is why it does not imply approval.
 */
export type DictionarySenseReviewState = "candidate" | "name_checked" | "historical" | "source_conflict";

export type DictionarySenseEditorialPriority = "P0" | "P1" | "P2" | "P3";

/**
 * An alias as the handover records it.
 *
 * Deliberately not flattened to a bare string on import. `kind` distinguishes a
 * lookup variant from a genuine synonym, and `evidenceStatus` says whether anyone
 * has checked it — both of which a reviewer needs and neither of which survives
 * `aliases.map((alias) => alias.value)`.
 */
export type DictionarySenseAlias = {
  value: string;
  kind: string;
  evidenceStatus: string;
};

export type DictionarySenseProvenance = {
  document: string;
  documentSha256: string;
  anchor: string;
  lineStart: number;
  lineEnd: number;
  rawBlockSha256: string;
};

export type DictionarySenseDraft = {
  /** Stable across the handover and any future re-import. Never regenerated. */
  id: string;
  /** Preserved exactly as the source writes it: `4AT`, `mg`, `Form 1A`. */
  token: string;
  normalizedToken: string;
  expansion: string;
  recordType: DictionarySenseRecordType;
  category: string;
  subcategory: string | null;
  context: string;
  jurisdiction: string;
  meaningNote: string | null;
  documentationStatus: string;
  documentationNote: string | null;
  /** The safety qualification. Never shown apart from the meaning it qualifies. */
  warning: string | null;
  aliases: readonly DictionarySenseAlias[];
  availabilityNote: string | null;
  linkedSenseIds: readonly string[];
  /** Normalised tokens this sense competes for. Drives the ambiguity groups. */
  collisionKeys: readonly string[];
  sourceIds: readonly string[];
  evidenceNote: string;
  reviewState: DictionarySenseReviewState;
  editorialPriority: DictionarySenseEditorialPriority;
  unresolvedIssues: readonly string[];
  clinicalApproval: { status: "pending"; reviewer: null; reviewedOn: null };
  publicationAllowed: false;
  semanticRevisionDate: string;
  provenance: DictionarySenseProvenance;
  /** Upstream integrity hash. Lets a re-import detect a silently edited draft. */
  contentHash: string;
};

export type DictionarySenseCollisionGroup = {
  tokenKey: string;
  senseIds: readonly string[];
  rule: string;
};

const data = draftData as {
  collisionRule: string;
  collisionGroups: readonly DictionarySenseCollisionGroup[];
  senses: readonly DictionarySenseDraft[];
};

export const dictionarySenseDrafts: readonly DictionarySenseDraft[] = data.senses;

/**
 * Ambiguity groups, computed over the whole corpus rather than a filtered view.
 *
 * This is the one rule the handover states twice, and it is a patient-safety rule
 * rather than a UI preference: a category or jurisdiction filter must never make a
 * globally ambiguous token look unambiguous. A reader who has filtered to
 * "Medicines notation" and sees only `BD — twice a day` must still be told that
 * `BD` means bipolar disorder elsewhere, because the note they are reading was not
 * written under their filter.
 */
export const dictionarySenseCollisionGroups: readonly DictionarySenseCollisionGroup[] = data.collisionGroups;

const draftById = new Map(dictionarySenseDrafts.map((draft) => [draft.id, draft]));

const groupByTokenKey = new Map(dictionarySenseCollisionGroups.map((group) => [group.tokenKey, group]));

export function dictionarySenseDraft(id: string): DictionarySenseDraft | null {
  return draftById.get(id) ?? null;
}

/**
 * Every governed meaning of a token, regardless of what the reader has filtered to.
 * Returns an empty array for an unambiguous token — the caller shows the collision
 * panel only when there is genuinely more than one meaning.
 */
export function dictionarySenseCollisions(token: string): readonly DictionarySenseDraft[] {
  const group = groupByTokenKey.get(normalizeSenseToken(token));
  if (!group) return [];
  return group.senseIds.map((id) => draftById.get(id)).filter((draft): draft is DictionarySenseDraft => Boolean(draft));
}

/**
 * The canonical lookup key for a token.
 *
 * Case and spacing are flattened; **every other character is kept**. That
 * restraint is the point: an earlier version of this stripped punctuation, which
 * silently merged `K10` with `K10+` — two different Kessler instruments, one with
 * supplementary questions — into a single ambiguous token. `ACE-III` is likewise
 * not `ACEIII`. A leading digit survives untouched so `4AT` stays reachable.
 *
 * Reader-facing search may be more forgiving than this. Identity may not.
 */
export function normalizeSenseToken(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-AU").split(/\s+/).filter(Boolean).join(" ");
}

/**
 * The A–Z bucket a draft files under.
 *
 * Numeric-leading tokens get a single `#` bucket rather than a per-digit one: `4AT`
 * and `15L` are the only shape in this corpus, and four digit buckets holding one
 * term each reads as noise next to twenty-six letters.
 */
export function dictionarySenseBrowseBucket(draft: DictionarySenseDraft): string {
  const first = draft.token.trim().charAt(0).toLocaleUpperCase("en-AU");
  if (!first) return "#";
  return /\p{L}/u.test(first) ? first : "#";
}

/**
 * The publication gate.
 *
 * Called by the contract test and by any future promotion path. It throws rather
 * than returning a boolean because there is no caller for whom a published draft is
 * an acceptable outcome to branch on.
 */
export function assertNoDraftIsPublished(drafts: readonly DictionarySenseDraft[] = dictionarySenseDrafts): void {
  const leaked = drafts.filter(
    (draft) => draft.publicationAllowed !== false || draft.clinicalApproval.status !== "pending",
  );
  if (leaked.length) {
    throw new Error(
      `Dictionary sense drafts are not clinically approved and must not be published: ${leaked
        .map((draft) => draft.id)
        .join(", ")}`,
    );
  }
}

/** Structural defects in the draft set. An empty array means the layer is sound. */
export function dictionarySenseDraftIssues(
  drafts: readonly DictionarySenseDraft[] = dictionarySenseDrafts,
  groups: readonly DictionarySenseCollisionGroup[] = dictionarySenseCollisionGroups,
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();

  for (const draft of drafts) {
    if (ids.has(draft.id)) issues.push(`${draft.id}: duplicate sense id`);
    ids.add(draft.id);
    if (!draft.token.trim()) issues.push(`${draft.id}: empty token`);
    if (!draft.expansion.trim()) issues.push(`${draft.id}: empty expansion`);
    if (normalizeSenseToken(draft.token) !== normalizeSenseToken(draft.normalizedToken)) {
      issues.push(`${draft.id}: normalizedToken does not match token`);
    }
    if (!draft.context.trim()) issues.push(`${draft.id}: missing context`);
    for (const alias of draft.aliases) {
      // The declared type said `string[]` until a review caught that all 63 aliases
      // in the corpus are objects. Checked here so the type cannot drift from the
      // data again without a test going red.
      if (typeof alias !== "object" || typeof alias.value !== "string" || !alias.value.trim()) {
        issues.push(`${draft.id}: alias is not a {value, kind, evidenceStatus} record`);
      }
    }
    if (!draft.jurisdiction.trim()) issues.push(`${draft.id}: missing jurisdiction`);
    for (const linked of draft.linkedSenseIds) {
      if (!drafts.some((other) => other.id === linked)) issues.push(`${draft.id}: unknown linked sense ${linked}`);
    }
  }

  for (const group of groups) {
    if (group.senseIds.length < 2) issues.push(`${group.tokenKey}: a collision group needs at least two senses`);
    for (const id of group.senseIds) {
      const draft = drafts.find((candidate) => candidate.id === id);
      if (!draft) {
        issues.push(`${group.tokenKey}: unknown sense ${id}`);
        continue;
      }
      if (normalizeSenseToken(draft.token) !== group.tokenKey) {
        issues.push(`${group.tokenKey}: ${id} normalises to ${normalizeSenseToken(draft.token)}`);
      }
    }
  }

  // A token with two meanings that is missing from the groups is the exact failure
  // the ambiguity rule exists to prevent, so it is checked from the data rather
  // than trusted from the handover's own list.
  const byKey = new Map<string, string[]>();
  for (const draft of drafts) {
    const key = normalizeSenseToken(draft.token);
    byKey.set(key, [...(byKey.get(key) ?? []), draft.id]);
  }
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    const group = groups.find((candidate) => candidate.tokenKey === key);
    if (!group) {
      issues.push(`${key}: ${members.length} senses share this token but no collision group covers it`);
      continue;
    }
    // Existence is not enough. A group listing two of the three `ACT` senses would
    // pass an existence check while `dictionarySenseCollisions("ACT")` silently
    // dropped the third meaning — which is the ambiguity rule failing quietly, the
    // one failure mode this whole layer exists to prevent.
    const missing = members.filter((id) => !group.senseIds.includes(id));
    if (missing.length) {
      issues.push(`${key}: collision group omits ${missing.join(", ")}`);
    }
  }

  return issues;
}
