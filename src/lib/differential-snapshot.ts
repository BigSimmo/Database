export type DifferentialLikelihood = "most-likely" | "possible" | "less-likely" | "must-not-miss";

export type DifferentialMapNode = {
  id: string;
  label: string;
  likelihood: DifferentialLikelihood;
  note: string;
};

export type DifferentialSection = {
  id: string;
  title: string;
  summary: string;
  items: string[];
  tone: "fit" | "warning" | "question" | "action" | "test" | "overlap";
};

export type DifferentialRecord = {
  slug: string;
  title: string;
  status: "emergent" | "urgent" | "routine";
  subtitle: string;
  clinicalHinge: string;
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
};

export type DifferentialComparisonCandidate = {
  slug: string;
  selected: boolean;
  comparison: Record<string, string>;
};

export type DifferentialPresentationWorkflow = {
  id: string;
  title: string;
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
