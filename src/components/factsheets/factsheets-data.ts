export type Factsheet = {
  slug: string;
  title: string;
  summary: string;
  topic: string;
  audience: string;
  readTime: string;
  updated: string;
  sections: Array<{ heading: string; body: string }>;
};

/**
 * Intentionally non-clinical sample content for the factsheet UI slice. These
 * records demonstrate the layout without presenting unreviewed patient advice.
 */
export const factsheets: Factsheet[] = [
  {
    slug: "appointment-planning",
    title: "Planning a follow-up appointment",
    summary: "A simple, patient-friendly structure for preparing questions and sharing what matters.",
    topic: "Appointments",
    audience: "Patients and supporters",
    readTime: "3 min read",
    updated: "Sample content",
    sections: [
      {
        heading: "Before you arrive",
        body: "Use this space for approved local information about preparing for an appointment, including what a patient may want to bring or ask.",
      },
      {
        heading: "Questions that matter to you",
        body: "A factsheet can help patients capture concerns in their own words and agree on the next step with their care team.",
      },
      {
        heading: "After the conversation",
        body: "Add locally approved contact details, review timing, and support options here before publishing this factsheet.",
      },
    ],
  },
  {
    slug: "support-network",
    title: "Involving your support network",
    summary: "A calm overview of choosing who to involve in a care conversation.",
    topic: "Support",
    audience: "Patients and supporters",
    readTime: "2 min read",
    updated: "Sample content",
    sections: [
      {
        heading: "Choose what feels helpful",
        body: "Use approved local copy to explain options for inviting a trusted person to a conversation, while respecting privacy and patient choice.",
      },
      {
        heading: "Make a shared plan",
        body: "A short, clear summary can help everyone understand the agreed next step and where to find further support.",
      },
    ],
  },
  {
    slug: "care-plan-notes",
    title: "Keeping notes about your care plan",
    summary: "A practical page for recording agreed actions in plain language.",
    topic: "Care planning",
    audience: "Patients",
    readTime: "2 min read",
    updated: "Sample content",
    sections: [
      {
        heading: "Keep it clear",
        body: "This sample section shows the intended reading rhythm. Replace it with approved, service-specific patient information before use.",
      },
      {
        heading: "Know where to get help",
        body: "Include verified local contacts and escalation information only after governance review.",
      },
    ],
  },
];

export const factsheetTopics = ["Appointments", "Support", "Care planning"] as const;

export function findFactsheet(slug: string) {
  return factsheets.find((factsheet) => factsheet.slug === slug);
}
