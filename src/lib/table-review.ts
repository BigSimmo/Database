import { z } from "zod";

export const tableReviewClasses = [
  "clinical_useful",
  "administrative",
  "reference",
  "unrelated",
  "bad_extraction",
] as const;

export type TableReviewClass = (typeof tableReviewClasses)[number];

export const tableReviewSchema = z.object({
  reviewClass: z.enum(tableReviewClasses),
  notes: z.string().trim().max(500).optional().default(""),
  confidence: z.number().min(0).max(1).optional().default(0.75),
});

export function tableReviewMetadata(args: {
  reviewClass: TableReviewClass;
  notes?: string;
  confidence?: number;
  reviewerId?: string | null;
}) {
  const reviewedAt = new Date().toISOString();
  return {
    review_class: args.reviewClass,
    review_notes: args.notes?.trim() || null,
    review_confidence: Math.max(0, Math.min(1, args.confidence ?? 0.75)),
    reviewed_by: args.reviewerId ?? null,
    reviewed_at: reviewedAt,
    clinical_use_class:
      args.reviewClass === "clinical_useful"
        ? "clinical_evidence"
        : args.reviewClass === "administrative"
          ? "administrative"
          : args.reviewClass === "reference"
            ? "reference"
            : args.reviewClass === "bad_extraction"
              ? "ambiguous"
              : "decorative_or_empty",
    table_role:
      args.reviewClass === "clinical_useful"
        ? "clinical"
        : args.reviewClass === "administrative"
          ? "admin"
          : args.reviewClass === "reference"
            ? "reference"
            : "unrelated",
  };
}

export function isReviewedTablePromotable(metadata: unknown) {
  const value = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const reviewClass = value.review_class;
  if (!reviewClass) return true;
  return reviewClass === "clinical_useful";
}
