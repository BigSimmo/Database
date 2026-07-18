/**
 * Patient factsheet library — content model and helpers.
 *
 * This module is intentionally framework-free (no React/lucide imports) so it can
 * be consumed by server route handlers (`generateStaticParams`, `generateMetadata`,
 * search filtering) as well as client components. Icons are referenced by a stable
 * key and mapped to Lucide components in `factsheets-icons.ts`.
 *
 * Governance: these sheets are patient-facing information written in plain language
 * and dated with a review month, drawn from reputable Australian consumer-health
 * sources (see each sheet's `sources`). They demonstrate the published factsheet
 * experience; connect only governance-approved patient information before
 * publication (surfaced via the verification footer and per-sheet disclaimer).
 */

export type FactsheetCategory = "Medications" | "Conditions" | "Therapies" | "Tests & procedures";

export type FactsheetKind = "medRich" | "medLite" | "condition" | "therapy" | "procedure";

export type FactsheetIconKey =
  | "capsule"
  | "layers"
  | "tablet"
  | "cloudRain"
  | "worry"
  | "swings"
  | "chatCheck"
  | "droplet"
  | "chat"
  | "pill"
  | "heart";

export type FactsheetSource = {
  n: string;
  title: string;
  org: string;
  year: string;
  tag: string;
  /**
   * Canonical URL for the cited source. Optional: only governance-approved,
   * verifiable links belong here. When present the detail page renders the
   * citation as an outbound link; when absent it renders as a plain citation
   * (no external-link affordance) rather than implying an openable source.
   */
  url?: string;
};

type FactsheetBase = {
  slug: string;
  title: string;
  /** Muted brand suffix rendered after the title, e.g. "(Zoloft)". */
  brand?: string;
  category: FactsheetCategory;
  audience: string;
  readTime: string;
  /** Human review month, e.g. "Jul 2026". */
  reviewedOn: string;
  icon: FactsheetIconKey;
  summary: string;
  sources: FactsheetSource[];
};

export type MedRichContent = {
  kind: "medRich";
  keyFacts: Array<{ k: string; v: string }>;
  whatEasy: string;
  whatStandard: string;
  howto: Array<{ n: string; t: string }>;
  sideCommon: string[];
  sideSerious: string[];
  urgentHelp: string;
};

export type MedLiteContent = {
  kind: "medLite";
  timing: string;
  sections: Array<{ heading: string; body: string }>;
};

export type ConditionContent = {
  kind: "condition";
  intro: string;
  signs: string[];
  why: string;
  helps: Array<{ icon: FactsheetIconKey; title: string; body: string }>;
  support: string;
};

export type TherapyContent = {
  kind: "therapy";
  intro: string;
  steps: Array<{ n: string; h: string; t: string }>;
  expect: Array<{ k: string; v: string }>;
};

export type ProcedureContent = {
  kind: "procedure";
  why: string;
  prepare: string[];
  timeline: Array<{ t: string; d: string }>;
  safe: string;
};

export type Factsheet = FactsheetBase &
  (MedRichContent | MedLiteContent | ConditionContent | TherapyContent | ProcedureContent);

export const factsheetCategories: readonly FactsheetCategory[] = [
  "Medications",
  "Conditions",
  "Therapies",
  "Tests & procedures",
] as const;

/** Category → accent theming, expressed as CSS values (token-based, dark-mode safe). */
export type FactsheetTheme = {
  /** Text/icon accent colour. */
  accent: string;
  /** Soft tint used for icon tiles and chips. */
  soft: string;
  /** Hero band gradient. */
  hero: string;
};

export function categoryTheme(category: FactsheetCategory): FactsheetTheme {
  switch (category) {
    case "Conditions":
      return {
        accent: "var(--tone-indigo)",
        soft: "color-mix(in srgb, var(--tone-indigo) 12%, var(--surface))",
        hero: "linear-gradient(135deg, color-mix(in srgb, var(--tone-indigo) 12%, var(--surface)) 0%, var(--surface) 68%)",
      };
    case "Therapies":
      return {
        accent: "var(--success-text)",
        soft: "var(--success-bg)",
        hero: "linear-gradient(135deg, var(--success-bg) 0%, var(--surface) 68%)",
      };
    case "Tests & procedures":
      return {
        accent: "var(--warning-text)",
        soft: "var(--warning-bg)",
        hero: "linear-gradient(135deg, var(--warning-bg) 0%, var(--surface) 68%)",
      };
    case "Medications":
    default:
      return {
        accent: "var(--clinical-accent)",
        soft: "var(--clinical-accent-soft)",
        hero: "linear-gradient(135deg, var(--clinical-accent-soft) 0%, var(--surface) 68%)",
      };
  }
}

const SOURCES: Record<string, FactsheetSource[]> = {
  sertraline: [
    {
      n: "1",
      title: "APO-Sertraline — Consumer Medicine Information",
      org: "healthdirect / TGA",
      year: "2025",
      tag: "Consumer",
    },
    { n: "2", title: "Sertraline (oral route)", org: "Mayo Clinic", year: "2026", tag: "Reference" },
    {
      n: "3",
      title: "Antidepressants: 10 things you should know",
      org: "NPS MedicineWise",
      year: "2022",
      tag: "Consumer",
    },
    { n: "4", title: "Antidepressants", org: "healthdirect Australia", year: "2025", tag: "Reference" },
  ],
  depression: [
    { n: "1", title: "Understanding depression", org: "Beyond Blue", year: "2025", tag: "Consumer" },
    { n: "2", title: "Types of depression", org: "Beyond Blue", year: "2025", tag: "Consumer" },
  ],
  gad: [
    {
      n: "1",
      title: "Generalised anxiety disorder (GAD)",
      org: "healthdirect Australia",
      year: "2024",
      tag: "Reference",
    },
    {
      n: "2",
      title: "Generalized anxiety disorder: what you need to know",
      org: "NIMH",
      year: "2024",
      tag: "Reference",
    },
  ],
  bipolar: [
    { n: "1", title: "Types of depression (bipolar disorder)", org: "Beyond Blue", year: "2025", tag: "Consumer" },
    { n: "2", title: "Bipolar disorder", org: "healthdirect Australia", year: "2025", tag: "Reference" },
  ],
  cbt: [
    {
      n: "1",
      title: "Generalised anxiety disorder — self-care (CBT)",
      org: "MedlinePlus",
      year: "2025",
      tag: "Reference",
    },
    { n: "2", title: "A guide to what works for depression", org: "Beyond Blue", year: "2013", tag: "Guideline" },
  ],
  ssri: [
    {
      n: "1",
      title: "Antidepressants: 10 things you should know",
      org: "NPS MedicineWise",
      year: "2022",
      tag: "Consumer",
    },
    { n: "2", title: "Antidepressants", org: "healthdirect Australia", year: "2025", tag: "Reference" },
  ],
  escitalopram: [
    { n: "1", title: "Antidepressants", org: "healthdirect Australia", year: "2025", tag: "Reference" },
    {
      n: "2",
      title: "Antidepressants: 10 things you should know",
      org: "NPS MedicineWise",
      year: "2022",
      tag: "Consumer",
    },
  ],
  "lithium-monitoring": [
    {
      n: "1",
      title: "Lithium — Consumer Medicine Information",
      org: "healthdirect / TGA",
      year: "2025",
      tag: "Consumer",
    },
    { n: "2", title: "Bipolar disorder", org: "healthdirect Australia", year: "2025", tag: "Reference" },
  ],
};

export const factsheets: Factsheet[] = [
  {
    slug: "sertraline",
    title: "Sertraline",
    brand: "(Zoloft)",
    category: "Medications",
    audience: "Patients starting an SSRI",
    readTime: "6 min read",
    reviewedOn: "Jul 2026",
    icon: "capsule",
    summary: "A commonly used SSRI for depression and anxiety — how it works, how to take it, and what to expect.",
    sources: SOURCES.sertraline,
    kind: "medRich",
    keyFacts: [
      { k: "Drug class", v: "SSRI antidepressant" },
      { k: "Common brand", v: "Zoloft" },
      { k: "Usual dose", v: "50–200 mg daily" },
      { k: "Takes effect", v: "2–6 weeks" },
      { k: "With food?", v: "Either way" },
      { k: "Availability", v: "Prescription (S4)" },
    ],
    whatEasy:
      "Sertraline is a medicine that helps with depression and anxiety. It gently rebalances a brain chemical called serotonin, which can lift your mood, ease worry and help you feel more like yourself. It is not addictive, and most people take it once a day.",
    whatStandard:
      "Sertraline is a selective serotonin reuptake inhibitor (SSRI). It increases the serotonin available between nerve cells by blocking its reuptake, which over several weeks improves mood and anxiety symptoms. It is a first-line treatment for major depression and several anxiety disorders and is not associated with dependence.",
    howto: [
      {
        n: "1",
        t: "Usually started at 50 mg once a day (sometimes 25 mg for the first week), in the morning or evening — with or without food.",
      },
      {
        n: "2",
        t: "Take it at the same time each day. Your doctor may adjust the dose, usually not above 200 mg a day.",
      },
      {
        n: "3",
        t: "If you miss a dose, take it when you remember — unless it is nearly time for the next one. Never take two doses at once.",
      },
      {
        n: "4",
        t: "Do not stop suddenly. When the time is right, your doctor will lower the dose slowly over a few weeks.",
      },
    ],
    sideCommon: [
      "Feeling sick (nausea)",
      "Headache",
      "Trouble sleeping, or feeling sleepy",
      "Dry mouth",
      "Looser or more frequent bowel movements",
    ],
    sideSerious: [
      "New or worsening thoughts of self-harm, especially early on",
      "Restlessness you can’t sit still with",
      "Unusual bruising or bleeding",
      "Fever with stiff or twitching muscles and confusion",
    ],
    urgentHelp:
      "Call 000 or go to your nearest emergency department if you have thoughts of harming yourself, or a fever with stiff or twitching muscles, sweating and confusion. You can also call the Poisons Information Centre on 13 11 26.",
  },
  {
    slug: "depression",
    title: "Understanding depression",
    category: "Conditions",
    audience: "Patients and supporters",
    readTime: "8 min read",
    reviewedOn: "Jun 2026",
    icon: "cloudRain",
    summary: "What depression is, the signs to look for, and the treatments and support that help.",
    sources: SOURCES.depression,
    kind: "condition",
    intro:
      "Depression is more than a low mood — it is a health condition that affects both your body and mind, and it can last for weeks, months or longer. It is common, and it is treatable.",
    signs: [
      "Low or flat mood most of the day",
      "Losing interest in things you enjoy",
      "Low energy or feeling slowed down",
      "Trouble sleeping, or sleeping too much",
      "Trouble concentrating or deciding",
      "Feeling worthless or guilty",
      "Changes in appetite or weight",
    ],
    why: "Depression usually develops from a combination of recent life events, personal and family history, and changes in the brain — rarely from a single cause. It is a health condition, not a weakness.",
    helps: [
      {
        icon: "chat",
        title: "Talking therapy",
        body: "Structured therapies like CBT help you understand and shift unhelpful patterns.",
      },
      {
        icon: "pill",
        title: "Medicines",
        body: "Antidepressants such as SSRIs can help, especially for moderate-to-severe depression.",
      },
      {
        icon: "heart",
        title: "Everyday support",
        body: "Routine, movement, sleep and trusted people all support recovery.",
      },
    ],
    support: "Your GP is a good place to start the conversation and build a plan together.",
  },
  {
    slug: "gad",
    title: "Generalised anxiety disorder",
    category: "Conditions",
    audience: "Patients and supporters",
    readTime: "7 min read",
    reviewedOn: "Jun 2026",
    icon: "worry",
    summary: "Persistent, hard-to-control worry — what it feels like and the therapies and medicines that help.",
    sources: SOURCES.gad,
    kind: "condition",
    intro:
      "Generalised anxiety disorder (GAD) is when worry happens most of the time and across many situations, often about everyday things. Everyone feels anxious sometimes, but in GAD the worry is harder to control and gets in the way of daily life.",
    signs: [
      "Worry that is hard to control",
      "Feeling restless or on edge",
      "Muscle tension or aches",
      "Tiring easily",
      "Trouble concentrating",
      "Irritability",
      "Poor sleep, often trouble getting off to sleep",
    ],
    why: "A mix of individual and environmental factors — genetics, brain chemistry, and stressful experiences — can contribute. Doctors usually consider GAD when symptoms have been present on most days for around six months.",
    helps: [
      {
        icon: "chat",
        title: "CBT",
        body: "Cognitive behavioural therapy is a first-line, well-evidenced treatment for worry.",
      },
      {
        icon: "pill",
        title: "Medicines",
        body: "Antidepressants such as SSRIs or SNRIs are effective; benzodiazepines are avoided long-term.",
      },
      {
        icon: "heart",
        title: "Lifestyle",
        body: "Regular sleep, cutting back on caffeine, and exercise all support treatment.",
      },
    ],
    support: "If worry is affecting your daily life, your GP can build a mental health care plan and refer you on.",
  },
  {
    slug: "ssri",
    title: "Antidepressants: SSRIs explained",
    category: "Medications",
    audience: "Anyone considering an antidepressant",
    readTime: "5 min read",
    reviewedOn: "Jun 2026",
    icon: "layers",
    summary: "The most commonly prescribed antidepressant class in Australia — how they work and what to expect.",
    sources: SOURCES.ssri,
    kind: "medLite",
    timing:
      "Most people feel better after 2–4 weeks; it can take 6–8 weeks for the full effect. Keep taking it as prescribed even once you feel well.",
    sections: [
      {
        heading: "What SSRIs are",
        body: "Selective serotonin reuptake inhibitors (SSRIs) are the most commonly prescribed class of antidepressant in Australia, and are usually well tolerated. Examples include sertraline, escitalopram, citalopram, fluoxetine, fluvoxamine and paroxetine.",
      },
      {
        heading: "How they work",
        body: "SSRIs are thought to work by increasing the activity of serotonin, a chemical messenger involved in mood, emotion and sleep. They treat depression and several anxiety conditions, and they are not addictive.",
      },
      {
        heading: "Side effects and stopping",
        body: "Early side effects such as trouble sleeping, nausea or dizziness often ease after a few weeks. Do not stop suddenly — when the time is right, the dose is lowered slowly over a few weeks. SSRIs work best alongside counselling, exercise and good sleep.",
      },
    ],
  },
  {
    slug: "cbt",
    title: "Cognitive behavioural therapy (CBT)",
    category: "Therapies",
    audience: "Patients considering therapy",
    readTime: "5 min read",
    reviewedOn: "Jun 2026",
    icon: "chatCheck",
    summary: "A structured talking therapy that helps you change unhelpful patterns of thinking and behaviour.",
    sources: SOURCES.cbt,
    kind: "therapy",
    intro:
      "Cognitive behavioural therapy is a structured, practical talking therapy delivered with a trained therapist. It is one of the most widely used and well-evidenced therapies for depression and anxiety.",
    steps: [
      {
        n: "1",
        h: "Notice your thoughts",
        t: "You learn to catch the automatic thoughts that show up in difficult moments.",
      },
      { n: "2", h: "See the links", t: "You map how thoughts, feelings and behaviours feed into each other." },
      { n: "3", h: "Test and try", t: "You gently test unhelpful thoughts and try new responses in everyday life." },
      { n: "4", h: "Build skills", t: "You practise between sessions so the skills stick and become your own." },
    ],
    expect: [
      { k: "Format", v: "Weekly sessions" },
      { k: "Length", v: "Usually 6–20 sessions" },
      { k: "Delivery", v: "In person or online" },
      { k: "Best for", v: "Depression, anxiety" },
    ],
  },
  {
    slug: "escitalopram",
    title: "Escitalopram (Lexapro)",
    category: "Medications",
    audience: "Patients starting an SSRI",
    readTime: "6 min read",
    reviewedOn: "May 2026",
    icon: "tablet",
    summary: "A commonly used SSRI antidepressant — what it is for and what to expect week by week.",
    sources: SOURCES.escitalopram,
    kind: "medLite",
    timing:
      "It commonly takes 2–4 weeks to notice improvement and up to 6–8 weeks for the full benefit. Keep taking it as prescribed and review progress with your doctor.",
    sections: [
      {
        heading: "What it is",
        body: "Escitalopram is a selective serotonin reuptake inhibitor (SSRI) used to treat depression and anxiety. Like other SSRIs it is usually well tolerated and is taken once a day.",
      },
      {
        heading: "What to expect",
        body: "It commonly takes 2–4 weeks to notice improvement and up to 6–8 weeks for the full benefit. Early side effects such as nausea or sleep changes often settle. Keep taking it as prescribed and review progress with your doctor.",
      },
      {
        heading: "Stopping safely",
        body: "Do not stop suddenly. Your doctor will help you lower the dose slowly if and when you decide to stop, to reduce withdrawal-type effects.",
      },
    ],
  },
  {
    slug: "bipolar",
    title: "Bipolar disorder",
    category: "Conditions",
    audience: "Patients and supporters",
    readTime: "8 min read",
    reviewedOn: "May 2026",
    icon: "swings",
    summary: "Periods of depression and periods of high mood (mania) — how it is recognised and managed.",
    sources: SOURCES.bipolar,
    kind: "condition",
    intro:
      "Bipolar disorder involves periods of depression and periods of elevated or high mood (mania or hypomania), with more settled periods in between. It affects around 2 in 100 people.",
    signs: [
      "Low periods with the signs of depression",
      "High periods with unusually elevated mood",
      "Reduced need for sleep during highs",
      "Fast thoughts or fast speech",
      "Doing more than usual, or taking risks",
      "Irritability",
      "Difficulty seeing the change in yourself",
    ],
    why: "Because people often seek help during the low periods, bipolar can be hard to diagnose. It helps your clinician to know about any periods of unusually high mood, not just the low times.",
    helps: [
      {
        icon: "pill",
        title: "Mood stabilisers",
        body: "Medicines such as lithium help steady mood over time and are monitored with blood tests.",
      },
      {
        icon: "chat",
        title: "Talking therapy",
        body: "Therapy and psychoeducation help you recognise early warning signs.",
      },
      {
        icon: "heart",
        title: "Routine & support",
        body: "Regular sleep, routine and a shared plan with your team help you stay well.",
      },
    ],
    support: "A shared plan with your care team helps you spot early warning signs and act early.",
  },
  {
    slug: "lithium-monitoring",
    title: "Lithium blood tests",
    category: "Tests & procedures",
    audience: "Patients taking lithium",
    readTime: "4 min read",
    reviewedOn: "May 2026",
    icon: "droplet",
    summary: "Why regular blood tests matter while taking lithium, and how to prepare for them.",
    sources: SOURCES["lithium-monitoring"],
    kind: "procedure",
    why: "Lithium works within a narrow range — too little may not help, and too much can be harmful — so regular blood tests check the level in your body and that your kidneys and thyroid are healthy.",
    prepare: [
      "Have your blood taken about 12 hours after your last dose",
      "Bring a list of your current medicines",
      "Tell the team if you have been unwell, vomiting or dehydrated",
      "Don’t change your dose unless your doctor tells you to",
    ],
    timeline: [
      { t: "Before", d: "Keep to your usual dose and your normal salt and fluid intake." },
      { t: "On the day", d: "Blood test taken about 12 hours after your last dose." },
      { t: "After", d: "Your team reviews the level plus kidney and thyroid results." },
    ],
    safe: "Keep well hydrated, keep your salt intake steady, and check with your doctor before starting new medicines (including anti-inflammatories), as these can change your lithium level.",
  },
];

const bySlug = new Map(factsheets.map((sheet) => [sheet.slug, sheet]));

/** Sheets shown on the home "Start with a factsheet" grid, in curated order. */
export const featuredFactsheetSlugs = ["sertraline", "depression", "gad", "ssri", "cbt", "lithium-monitoring"];

const relatedMap: Record<string, string[]> = {
  sertraline: ["depression", "ssri", "escitalopram"],
  depression: ["sertraline", "cbt", "gad"],
  gad: ["cbt", "ssri", "sertraline"],
  ssri: ["sertraline", "escitalopram", "depression"],
  cbt: ["depression", "gad", "ssri"],
  escitalopram: ["sertraline", "ssri", "depression"],
  bipolar: ["lithium-monitoring", "depression", "ssri"],
  "lithium-monitoring": ["bipolar", "ssri", "sertraline"],
};

export function findFactsheet(slug: string): Factsheet | undefined {
  return bySlug.get(slug);
}

export function factsheetSlugs(): string[] {
  return factsheets.map((sheet) => sheet.slug);
}

export function featuredFactsheets(): Factsheet[] {
  return featuredFactsheetSlugs.map((slug) => bySlug.get(slug)).filter((sheet): sheet is Factsheet => Boolean(sheet));
}

/** Server-driven filter for the search page: optional query + optional category. */
export function filterFactsheets(query: string, category?: string): Factsheet[] {
  const q = query.trim().toLowerCase();
  const activeCategory = factsheetCategories.find((entry) => entry === category);
  return factsheets
    .filter((sheet) => !activeCategory || sheet.category === activeCategory)
    .filter((sheet) => {
      if (!q) return true;
      // Include the brand suffix (e.g. "(Zoloft)") so brand-name searches resolve
      // even though it is stored separately from the title.
      return `${sheet.title} ${sheet.brand ?? ""} ${sheet.summary} ${sheet.category} ${sheet.audience}`
        .toLowerCase()
        .includes(q);
    });
}

export function relatedFactsheets(slug: string): Factsheet[] {
  const ids = relatedMap[slug] ?? ["depression", "gad", "cbt"];
  return ids.map((id) => bySlug.get(id)).filter((sheet): sheet is Factsheet => Boolean(sheet));
}

export function sameTopicFactsheets(slug: string): Factsheet[] {
  const sheet = bySlug.get(slug);
  if (!sheet) return [];
  return factsheets.filter((entry) => entry.category === sheet.category && entry.slug !== sheet.slug);
}

/** Count of sheets per category, for the home browse pills. */
export function categoryCount(category: FactsheetCategory): number {
  return factsheets.filter((sheet) => sheet.category === category).length;
}

// ---- Print + table-of-contents projections -------------------------------------------------

export type PrintBlock =
  | { kind: "prose"; heading: string; body: string }
  | { kind: "list"; heading: string; items: string[] }
  | { kind: "facts"; heading: string; items: Array<{ k: string; v: string }> }
  | { kind: "sources"; heading: string; items: FactsheetSource[] };

export function printBlocks(sheet: Factsheet): PrintBlock[] {
  const sourcesBlock: PrintBlock = { kind: "sources", heading: "Sources", items: sheet.sources };
  switch (sheet.kind) {
    case "medRich":
      return [
        { kind: "facts", heading: "At a glance", items: sheet.keyFacts },
        { kind: "prose", heading: "What is this medicine?", body: sheet.whatStandard },
        { kind: "list", heading: "How to take it", items: sheet.howto.map((step) => step.t) },
        { kind: "list", heading: "Common side effects", items: sheet.sideCommon },
        { kind: "list", heading: "Serious — tell your doctor", items: sheet.sideSerious },
        { kind: "prose", heading: "When to get urgent help", body: sheet.urgentHelp },
        sourcesBlock,
      ];
    case "medLite":
      return [
        { kind: "prose", heading: "How long it takes", body: sheet.timing },
        ...sheet.sections.map((section): PrintBlock => ({
          kind: "prose",
          heading: section.heading,
          body: section.body,
        })),
        sourcesBlock,
      ];
    case "condition":
      return [
        { kind: "prose", heading: "In plain terms", body: sheet.intro },
        { kind: "list", heading: "Signs to look for", items: sheet.signs },
        { kind: "prose", heading: "Why it happens", body: sheet.why },
        { kind: "list", heading: "What helps", items: sheet.helps.map((help) => `${help.title} — ${help.body}`) },
        {
          kind: "prose",
          heading: "Getting support",
          body: `${sheet.support} In Australia you can call Beyond Blue 1300 22 4636, Lifeline 13 11 14, or 000 in an emergency.`,
        },
        sourcesBlock,
      ];
    case "therapy":
      return [
        { kind: "prose", heading: "What it is", body: sheet.intro },
        { kind: "list", heading: "How it works", items: sheet.steps.map((step) => `${step.h} — ${step.t}`) },
        { kind: "facts", heading: "What to expect", items: sheet.expect },
        sourcesBlock,
      ];
    case "procedure":
      return [
        { kind: "prose", heading: "Why it matters", body: sheet.why },
        { kind: "list", heading: "How to prepare", items: sheet.prepare },
        { kind: "list", heading: "Step by step", items: sheet.timeline.map((step) => `${step.t} — ${step.d}`) },
        { kind: "prose", heading: "Staying safe between tests", body: sheet.safe },
        sourcesBlock,
      ];
  }
}

export function tocFor(sheet: Factsheet): string[] {
  switch (sheet.kind) {
    case "medRich":
      return [
        "At a glance",
        "What is this medicine?",
        "How to take it",
        "Side effects",
        "When to get urgent help",
        "Sources",
      ];
    case "medLite":
      return ["How long it takes", ...sheet.sections.map((section) => section.heading), "Sources"];
    case "condition":
      return ["In plain terms", "Signs to look for", "Why it happens", "What helps", "You’re not alone", "Sources"];
    case "therapy":
      return ["What it is", "How it works", "What to expect", "Sources"];
    case "procedure":
      return ["Why it matters", "How to prepare", "Step by step", "Staying safe", "Sources"];
  }
}
