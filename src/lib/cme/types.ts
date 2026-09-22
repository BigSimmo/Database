export const cmeCategories = ["educational", "reviewing", "measuring"] as const;
export type CmeCategory = (typeof cmeCategories)[number];

export const cmeCategoryLabels: Record<CmeCategory, string> = {
  educational: "Educational activities",
  reviewing: "Reviewing performance",
  measuring: "Measuring outcomes",
};

/**
 * Four shapes, because three of them cannot be expressed as hours in a category
 * and every tracker that models only the first quietly misses them.
 *
 * The shape lives in a JSON `spec` column rather than in columns of its own, so
 * a shape this design does not yet draw — a trainee's weekly supervision
 * cadence, a count scoped to a rotation — is a code change rather than a
 * migration against the live clinical database.
 */
export type CmeRequirementSpec =
  | { shape: "credited-hours"; credit: "formal-peer-review"; minimumHours: number }
  | { shape: "hours-in-category"; category: CmeCategory; minimumHours: number }
  | {
      shape: "hours-across-categories";
      categories: readonly CmeCategory[];
      minimumHours: number;
      /** Each named category must also reach this on its own. */
      minimumEachHours: number;
    }
  | { shape: "activity-count"; buckets: readonly string[]; minimumPerBucket: number }
  | { shape: "task" };

export type CmeRequirementSource = "national" | "college";

export type CmeRequirement = {
  readonly id: string;
  readonly label: string;
  readonly source: CmeRequirementSource;
  readonly spec: CmeRequirementSpec;
  /** For `task` requirements only: whether the owner has marked it done. */
  readonly completedOn: string | null;
};

export type CmeAllocation = { readonly category: CmeCategory; readonly hours: number };

export type CmeEntry = {
  readonly archivedAt?: string | null;
  readonly evidenceCount?: number;
  /** A learning source link, not evidence of participation. */
  readonly sourceUrl?: string | null;
  /** Credit within reviewing hours, never extra hours added to the total. */
  readonly formalPeerReviewHours?: number;
  readonly id: string;
  /** Perth calendar date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly title: string;
  readonly allocations: readonly CmeAllocation[];
  readonly reflection: string;
  readonly costCents: number | null;
  readonly transcribed: boolean;
  readonly routineId: string | null;
  readonly documentId: string | null;
  /** Free-text buckets this entry counts toward, for `activity-count` requirements. */
  readonly buckets: readonly string[];
};

export type CmeRequirementSet = {
  readonly closedAt?: string | null;
  readonly year: number;
  /** When the owner confirmed these targets, and against what. Rendered on every screen showing a target. */
  readonly confirmedOn: string;
  readonly confirmedSource: string;
  readonly totalHours: number;
  readonly requirements: readonly CmeRequirement[];
};

export type CmeRequirementStatus = {
  readonly requirementId: string;
  readonly met: boolean;
  /** Null for shapes with no single scalar, such as a per-bucket count. */
  readonly progress: { readonly value: number; readonly target: number } | null;
  /** One plain sentence: "Met", "3 hours short", "Ethical practice has nothing against it yet". */
  readonly summary: string;
};
