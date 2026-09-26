import type { CmeRequirementSet } from "@/lib/cme/types";

export const CME_PRESET_VERSION = "au-ranzcp-2026-v1";
export const CME_PRESET_SOURCES = [
  {
    label: "Medical Board of Australia CPD registration standard",
    url: "https://www.medicalboard.gov.au/Registration-Standards/Continuing-professional-development.aspx",
  },
  {
    label: "RANZCP psychiatry peer review overview",
    url: "https://www.ranzcp.org/cpd-program-membership/cpd-program/cpd-overview",
  },
] as const;
export const CME_PRACTICE_DOMAINS = [
  "Culturally safe practice",
  "Addressing health inequities",
  "Professionalism",
  "Ethical practice",
] as const;
/** The screen name of the starting preset. The stored source keeps the internal id and the source URLs. */
const CME_PRESET_LABEL = "RANZCP (Medical Board baseline plus RANZCP peer review)";
/** Any version of the preset id (`au-ranzcp-2026-v1`, and next year's `au-ranzcp-2027-v1`), so a new id never shows raw. */
const CME_PRESET_ID = /^au-ranzcp-\d{4}-v\d+\b/;

/**
 * The confirmed source as a person reads it: the preset's plain name instead of its internal id
 * (`au-ranzcp-2026-v1; https://…`), otherwise the owner's own words. Screens only — the CSV export
 * keeps the stored text exactly as it was confirmed.
 */
export function describeConfirmedSource(source: string): string {
  const trimmed = source.trim();
  if (CME_PRESET_ID.test(trimmed)) return CME_PRESET_LABEL;
  return trimmed || "Your own targets";
}

/** Australian baseline + psychiatry peer review. Confirm additional CPD-home requirements. A starting draft only. The owner must review and explicitly confirm it before saving. */
export function createAustralianRanzcpPreset(year: number, confirmedOn: string): CmeRequirementSet {
  return {
    year,
    confirmedOn,
    confirmedSource: `${CME_PRESET_VERSION}; ${CME_PRESET_SOURCES.map((s) => s.url).join("; ")}`,
    totalHours: 50,
    requirements: [
      {
        id: "educational",
        label: "Educational activities",
        source: "national",
        completedOn: null,
        spec: { shape: "hours-in-category", category: "educational", minimumHours: 12.5 },
      },
      {
        id: "combined",
        label: "Reviewing performance and measuring outcomes",
        source: "national",
        completedOn: null,
        spec: {
          shape: "hours-across-categories",
          categories: ["reviewing", "measuring"],
          minimumHours: 25,
          minimumEachHours: 5,
        },
      },
      {
        id: "domains",
        label: "Professional development domains",
        source: "national",
        completedOn: null,
        spec: { shape: "activity-count", buckets: CME_PRACTICE_DOMAINS, minimumPerBucket: 1 },
      },
      {
        id: "plan",
        label: "Professional development plan",
        source: "national",
        completedOn: null,
        spec: { shape: "task" },
      },
      {
        id: "self-evaluation",
        label: "Annual self-evaluation",
        source: "national",
        completedOn: null,
        spec: { shape: "task" },
      },
      {
        id: "peer-review",
        label: "Formal peer review",
        source: "college",
        completedOn: null,
        spec: { shape: "credited-hours", credit: "formal-peer-review", minimumHours: 10 },
      },
    ],
  };
}
