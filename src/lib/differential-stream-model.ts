/**
 * Client-safe serializable types for the differentials stream workspace.
 * Keep this module free of `@/lib/differentials` / snapshot loaders.
 */

import type { DifferentialLikelihood, DifferentialRecord } from "@/lib/differential-snapshot";

export type DifferentialStreamType = "presentations" | "diagnoses";

export type DifferentialStreamRelatedRef = {
  slug: string;
  label: string;
  likelihood: DifferentialLikelihood;
};

export type DifferentialStreamItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  examples: string[];
  href: string;
  status: DifferentialRecord["status"];
  matchReasons: string[];
  isMatch: boolean;
  score: number;
  related: DifferentialStreamRelatedRef[];
  exclusionPreview: string | null;
  chapterId: string;
  chapterTitle: string;
};

export type DifferentialStreamChapter = {
  id: string;
  title: string;
  description: string;
  itemIds: string[];
};

export type DifferentialStreamPresetChip = {
  id: string;
  label: string;
  query: string;
};

export type DifferentialStreamModel = {
  stream: DifferentialStreamType;
  items: DifferentialStreamItem[];
  matchCount: number;
  chapters: DifferentialStreamChapter[];
  presentationChapters: DifferentialStreamChapter[];
  presets: DifferentialStreamPresetChip[];
  safetyShelfIds: string[];
};
