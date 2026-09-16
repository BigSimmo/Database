export type DifferentialLikelihood = "most-likely" | "possible" | "less-likely" | "must-not-miss";

export type DifferentialMapNode = {
  id: string;
  label: string;
  likelihood: DifferentialLikelihood;
  note: string;
};

/**
 * Whether a piece of differential text describes the individual diagnosis or the
 * presentation group it sits under.
 *
 * The export parser derives diagnosis records from their presentation, and
 * several fields on that presentation — the clinical hinge, immediate actions,
 * investigations and mimics — are written about the group. Copying them onto a
 * diagnosis without saying so makes the app state something clinically false
 * about that diagnosis (acute dystonia carried the akathisia hinge and a tremor
 * workup). Absent or "diagnosis" means the text is about this diagnosis;
 * "presentation" means it is group context and must never be rendered as this
 * diagnosis's own discriminator. Guarded by
 * `tests/differentials-presentation-scope.test.ts`.
 */
export type DifferentialTextScope = "diagnosis" | "presentation";

export type DifferentialSection = {
  id: string;
  title: string;
  summary: string;
  items: string[];
  tone: "fit" | "warning" | "question" | "action" | "test" | "overlap";
  scope?: DifferentialTextScope;
};

export type DifferentialRecord = {
  slug: string;
  title: string;
  status: "emergent" | "urgent" | "routine";
  subtitle: string;
  clinicalHinge: string;
  /** Scope of `clinicalHinge`. See {@link DifferentialTextScope}. */
  clinicalHingeScope?: DifferentialTextScope;
  safetySnapshot: {
    summary: string;
    tags: string[];
  };
  sections: DifferentialSection[];
  related: DifferentialMapNode[];
  currentPresentation: string[];
  investigations: string[];
  immediateActions: string[];
};

export type DifferentialComparisonCriterion = {
  id: string;
  title: string;
  tone: DifferentialSection["tone"];
  /**
   * Scope of every candidate's answer under this criterion. See
   * {@link DifferentialTextScope}. A "presentation" criterion holds the same
   * group-level text for every candidate, so the comparison table must present
   * it as shared context rather than as a point of difference.
   */
  scope?: DifferentialTextScope;
};

export type DifferentialComparisonCandidate = {
  slug: string;
  selected: boolean;
  comparison: Record<string, string>;
};

export type DifferentialPresentationWorkflow = {
  id: string;
  title: string;
  /** Original imported title retained when a clearer presentation label is applied. */
  sourceTitle?: string;
  /** Short, non-slash description of the clinical territory covered by the workflow. */
  scopeLabel?: string;
  /** Legacy and alternate terms that must continue to find this workflow. */
  titleAliases?: string[];
  status: DifferentialRecord["status"];
  subtitle: string;
  selectedCount: number;
  totalCount: number;
  safetySnapshot: {
    summary: string;
    tags: string[];
  };
  criteria: DifferentialComparisonCriterion[];
  candidates: DifferentialComparisonCandidate[];
  reviewChecklist: string[];
  highestUrgencyNote: string;
  sourceStatus: {
    label: string;
    version: string;
    lastUpdated: string;
  };
};

/**
 * The hinge only where it is written about this diagnosis.
 *
 * Most imported hinges describe the presentation group instead, so any surface
 * that shows a diagnosis's own description — a search subtitle, a stream card, a
 * cross-mode link — must use this and fall back to the diagnosis's own summary.
 * Rendering a group hinge there states something clinically false about the
 * diagnosis, which is how acute dystonia came to read as akathisia.
 */
export function diagnosisScopedHinge(record: Pick<DifferentialRecord, "clinicalHinge" | "clinicalHingeScope">): string {
  if (record.clinicalHingeScope === "presentation") return "";
  return record.clinicalHinge?.trim() ? record.clinicalHinge : "";
}

/**
 * The diagnosis's own one-line description, never the presentation's hinge.
 *
 * Returns "" when the record carries nothing diagnosis-specific. It deliberately
 * does not fall back to the title — a subtitle that repeats the heading is noise,
 * and callers already treat an empty value as "show nothing here". Every record
 * in the current corpus has an own summary, so the empty case is a guard against
 * a future sparse import rather than a state the app renders today.
 */
export function diagnosisOwnSummary(
  record: Pick<DifferentialRecord, "clinicalHinge" | "clinicalHingeScope" | "subtitle">,
): string {
  return diagnosisScopedHinge(record) || record.subtitle?.trim() || "";
}

export type DifferentialScenarioPreset = {
  id: string;
  query: string;
  signals: string[];
  entryIds: string[];
  presentationSlugs: string[];
};

export type DifferentialRedFlagFlow = {
  id: string;
  title: string;
  entryId: string;
  presentationSlug: string;
  bedsideQuestions: string;
  keyRedFlags: string;
};

export type DifferentialSnapshotGovernance = {
  version: string;
  reviewStatus: string;
  sourceTitle: string;
};

/** Entry files in the differentials export open with metadata rows ("Urgency:
 *  urgent", "Axis: mixed", "Population: general"). When a file has no title
 *  line, the first line after the header is one of these rows rather than a
 *  real title; the parser detects that with this predicate and falls back to
 *  the header text so the entry gets an honest title (never a metadata row). */
export function isDifferentialMetadataArtifactTitle(title: string) {
  return /^(urgency|axis|population)\s*:/i.test(title.trim());
}

export type DifferentialSnapshot = {
  version: string;
  exportedAt: string;
  presentations: DifferentialPresentationWorkflow[];
  diagnoses: DifferentialRecord[];
  presets: DifferentialScenarioPreset[];
  redFlagFlows: DifferentialRedFlagFlow[];
  searchAliases: Record<string, string[]>;
  governance: DifferentialSnapshotGovernance;
};
