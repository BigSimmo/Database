import type {
  DifferentialPresentationWorkflow,
  DifferentialRecord,
} from "@/lib/differentials";

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

export type DifferentialSnapshot = {
  version: string;
  exportedAt: string;
  presentations: DifferentialPresentationWorkflow[];
  diagnoses: DifferentialRecord[];
  presets: DifferentialScenarioPreset[];
  redFlagFlows: DifferentialRedFlagFlow[];
  searchAliases: Record<string, string[]>;
  governance: {
    version: string;
    reviewStatus: string;
    sourceTitle: string;
  };
};
