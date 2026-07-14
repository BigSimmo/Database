// Types for the trimmed Therapy Compass content export
// (public/mockups/therapy-compass/*.json). Fields mirror the export's
// `data/therapies.json` after trimming to what the UI renders.

export type ReviewStatus = "reviewed" | "needs_review" | string;

export type TherapySource = {
  title: string | null;
  sourceType: string | null;
  reference: string | null;
};

export type PatientSheetTemplate = {
  title: string | null;
  body: string | null;
  readingLevel: string | null;
  tone: string | null;
  length: string | null;
};

export type ClinicianScript = {
  scriptType: string | null;
  title: string | null;
  body: string | null;
};

export type ReviewChecklist = {
  clinicalAccuracyReviewed: boolean;
  sourceChecked: boolean;
  evidenceAppraised: boolean;
  safetyCautionsChecked: boolean;
  patientExplanationChecked: boolean;
  proofread: boolean;
  australianEnglishChecked: boolean;
};

export type Therapy = {
  slug: string;
  name: string;
  category: string;
  modality: string | null;
  clinicalSummary: string | null;
  bestUsedFor: string | null;
  indications: string | null;
  contraindicationsOrCautions: string | null;
  deliverySteps: string | null;
  patientExplanation: string | null;
  sourceNotes: string | null;
  targetSymptoms: string | null;
  patientPopulation: string | null;
  setting: string | null;
  sessionLength: string | null;
  timeRequired: string | null;
  complexity: string | null;
  mechanism: string | null;
  briefVersion: string | null;
  fifteenMinuteVersion: string | null;
  fullSessionVersion: string | null;
  homework: string | null;
  materials: string | null;
  commonPitfalls: string | null;
  alternatives: string | null;
  relatedTherapies: string | null;
  evidenceLevel: string | null;
  evidenceNotes: string | null;
  limitations: string | null;
  references: string | null;
  reviewStatus: ReviewStatus;
  confidenceLevel: string | null;
  contentOrigin: string | null;
  patientSheetAvailable: boolean;
  briefInterventionAvailable: boolean;
  sourceCompleteness: number | null;
  indexCompleteness: number | null;
  reviewCompleteness: number | null;
  tags: string[];
  warnings: string[];
  aliases: string[];
  sources: TherapySource[];
  patientSheetTemplates: PatientSheetTemplate[];
  clinicianScripts: ClinicianScript[];
  reviewChecklist: ReviewChecklist | null;
};

export type PathwayStep = {
  therapySlug: string | null;
  label: string | null;
  description: string | null;
};

export type Pathway = {
  slug: string;
  name: string;
  clinicalProblem: string | null;
  summary: string | null;
  cautions: string | null;
  incomplete: boolean;
  reviewStatus: ReviewStatus;
  steps: PathwayStep[];
};

export type Measure = {
  name: string;
  clinicalDomain: string | null;
  whenToUse: string | null;
  frequency: string | null;
  reviewStatus: string | null;
};

export type ReferenceData = {
  categories: { name: string }[];
  tags: { name: string }[];
  measures: Measure[];
};

export type TherapyDataset = {
  therapies: Therapy[];
  pathways: Pathway[];
  reference: ReferenceData;
};
