/**
 * Enumerating the clinical catalogues the governance audit is supposed to check.
 *
 * WHAT WENT WRONG. `scripts/audit-source-governance.ts` loaded two committed
 * catalogues and read them at keys that do not exist:
 *
 *   data/differentials-snapshot.json → `.records`     (real keys: diagnoses, presentations)
 *   data/specifiers-content.json     → `.specifiers`  (real shape: categories[].disorders[].groups[].items[])
 *
 * Both reads ended in `?? []`, so both produced an empty array and the audit
 * carried on. 232 differential records and 603 specifier records — 835 in all —
 * contributed nothing, and the reviewer-attribution gate passed for both corpora
 * by having no rows to examine. Nothing failed. Nothing warned. The audit
 * reported success on a population it never loaded.
 *
 * `?? []` is the whole defect. It turns "this key is missing" into "there is
 * nothing here", and those are opposite findings: the first means the audit is
 * broken, the second means the corpus is clean.
 *
 * SO THIS MODULE REFUSES TO GUESS. A population that is absent, not an array, or
 * disagrees with the file's own declared count raises. `src/lib/specifiers-content.ts`
 * already holds that line — `assertUsableSpecifiersContent` refuses an empty
 * catalogue rather than serving one — and the audit simply never had the same
 * instinct about its own inputs.
 *
 * Every function here is pure and takes already-parsed JSON, so the traversal can
 * be tested against small fixtures without touching disk, the module cache, or
 * Supabase.
 */
import type { AuditableRecord } from "../audit-source-governance";

/**
 * One named population, counted on its own.
 *
 * Separate counts matter: a single combined total lets one population empty
 * silently while the other's rows keep the number looking plausible. The audit
 * must be able to say "presentations: 31 of a declared 31", not just "232".
 */
export type CataloguePopulation = {
  /** Stable identifier for reporting, e.g. "differential-diagnoses". */
  name: string;
  /** The count the file declares about itself, where it declares one. */
  declared: number | null;
  /** The count actually reached by traversal. */
  observed: number;
  records: AuditableRecord[];
};

class CatalogueShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueShapeError";
  }
}

function asRecord(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogueShapeError(`${source} is not a JSON object; the governance audit cannot enumerate it.`);
  }
  return value as Record<string, unknown>;
}

/**
 * Require an array at `key`. Absent, null or wrong-typed all raise — this is the
 * exact branch that used to fall through to `?? []`.
 */
function requireArray(container: Record<string, unknown>, key: string, source: string): unknown[] {
  const value = container[key];
  if (value === undefined || value === null) {
    throw new CatalogueShapeError(
      `${source} has no "${key}" population. This is an audit-coverage failure, not an empty corpus — ` +
        `do not treat it as zero records.`,
    );
  }
  if (!Array.isArray(value)) {
    throw new CatalogueShapeError(`${source} has "${key}" but it is ${typeof value}, not an array.`);
  }
  return value;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Cross-check a traversal against the count the file declares about itself.
 *
 * A declared count is not independent verification — it is committed alongside
 * the data by the same generator. It is still worth checking, because the failure
 * it catches is the one that happened: a traversal that reaches far fewer records
 * than the file says it holds.
 */
function assertDeclaredCount(population: CataloguePopulation, source: string) {
  if (population.declared !== null && population.declared !== population.observed) {
    throw new CatalogueShapeError(
      `${source} declares ${population.declared} ${population.name} but traversal reached ${population.observed}. ` +
        `Refusing to audit a population the file disagrees with.`,
    );
  }
}

/**
 * data/differentials-snapshot.json → its two real populations.
 *
 * `diagnoses` and `presentations` are different record kinds with different
 * fields, and they are returned separately so a coverage report can say which one
 * emptied. The old code looked for a `records` key that has never existed in this
 * file's committed history.
 */
export function enumerateDifferentialAuditRecords(snapshot: unknown): CataloguePopulation[] {
  const source = "data/differentials-snapshot.json";
  const root = asRecord(snapshot, source);

  const build = (key: "diagnoses" | "presentations", recordType: string): CataloguePopulation => {
    const rows = requireArray(root, key, source);
    const records = rows.map((row, index) => {
      const record = asRecord(row, `${source} ${key}[${index}]`);
      return {
        record,
        recordType,
        identifier: text(record.id) ?? text(record.slug) ?? text(record.title) ?? `${key}[${index}]`,
        title: text(record.title) ?? text(record.name) ?? `Unnamed ${recordType}`,
        source,
      } satisfies AuditableRecord;
    });
    return { name: `differential-${key}`, declared: null, observed: records.length, records };
  };

  return [build("diagnoses", "differential-diagnosis"), build("presentations", "differential-presentation")];
}

/**
 * data/specifiers-content.json → its two real populations.
 *
 * The nested walk mirrors `buildCatalog()` in src/lib/specifiers-content.ts, which
 * is the canonical reader for this file. It deliberately also covers
 * `universalSpecifiers`, which `specifierCatalogItems()` excludes — those 18
 * entries are catalogue content too, and a governance audit that skipped them
 * would be repeating this defect on a smaller scale.
 *
 * Review state for a specifier lives at `item.review.clinicianReviewStatus`, not
 * at a top-level `reviewStatus`, so it is lifted onto the audited record. Every
 * one of the 585 is `clinician-review-pending` today, so nothing here changes any
 * record's status — it stops the audit being unable to see the field at all.
 */
export function enumerateSpecifierAuditRecords(content: unknown): CataloguePopulation[] {
  const source = "data/specifiers-content.json";
  const root = asRecord(content, source);
  const stats = root.stats && typeof root.stats === "object" ? (root.stats as Record<string, unknown>) : {};
  const declared = (key: string) => (typeof stats[key] === "number" ? (stats[key] as number) : null);

  const items: AuditableRecord[] = [];
  for (const [categoryIndex, rawCategory] of requireArray(root, "categories", source).entries()) {
    const category = asRecord(rawCategory, `${source} categories[${categoryIndex}]`);
    const categoryName = text(category.name) ?? text(category.id) ?? `category[${categoryIndex}]`;
    for (const [disorderIndex, rawDisorder] of requireArray(category, "disorders", categoryName).entries()) {
      const disorder = asRecord(rawDisorder, `${categoryName} disorders[${disorderIndex}]`);
      const disorderName = text(disorder.name) ?? `disorder[${disorderIndex}]`;
      for (const [groupIndex, rawGroup] of requireArray(disorder, "groups", disorderName).entries()) {
        const group = asRecord(rawGroup, `${disorderName} groups[${groupIndex}]`);
        for (const [itemIndex, rawItem] of requireArray(
          group,
          "items",
          `${disorderName} group[${groupIndex}]`,
        ).entries()) {
          const item = asRecord(rawItem, `${disorderName} group[${groupIndex}] items[${itemIndex}]`);
          const review = item.review && typeof item.review === "object" ? (item.review as Record<string, unknown>) : {};
          items.push({
            // Lift the nested clinician status so isRecordMarkedReviewed can read
            // it, without altering the stored record.
            record: { ...item, reviewStatus: review.clinicianReviewStatus },
            recordType: "specifier-item",
            identifier: text(review.rowKey) ?? `${disorderName}:${text(item.label) ?? itemIndex}`,
            title: text(item.label) ?? "Unnamed specifier",
            source,
          });
        }
      }
    }
  }

  const universal = requireArray(root, "universalSpecifiers", source).map((rawItem, index) => {
    const item = asRecord(rawItem, `${source} universalSpecifiers[${index}]`);
    const review = item.review && typeof item.review === "object" ? (item.review as Record<string, unknown>) : {};
    return {
      record: { ...item, reviewStatus: review.clinicianReviewStatus },
      recordType: "specifier-universal",
      identifier: text(review.rowKey) ?? text(item.title) ?? `universalSpecifiers[${index}]`,
      title: text(item.title) ?? "Unnamed universal specifier",
      source,
    } satisfies AuditableRecord;
  });

  const populations: CataloguePopulation[] = [
    { name: "specifier-items", declared: declared("specifierItems"), observed: items.length, records: items },
    {
      name: "specifier-universal",
      declared: declared("universalSpecifiers"),
      observed: universal.length,
      records: universal,
    },
  ];
  for (const population of populations) assertDeclaredCount(population, source);
  return populations;
}

export { CatalogueShapeError };
