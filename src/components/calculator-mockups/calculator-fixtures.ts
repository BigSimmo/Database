import {
  Activity,
  AlertTriangle,
  Baby,
  Brain,
  CloudRain,
  GlassWater,
  HeartPulse,
  Repeat2,
  ShieldAlert,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type CalculatorTone = "success" | "info" | "warning" | "danger";

export type CalculatorOption = {
  label: string;
  /** Compact label for segmented controls on narrow screens. */
  short: string;
  points: number;
};

export type CalculatorItem = {
  id: string;
  text: string;
  /** Optional clarifier rendered under the item text. */
  detail?: string;
  /**
   * checkbox items score `points` when ticked and 0 when clear;
   * options items score the selected option.
   */
  kind: "checkbox" | "options";
  points?: number;
  options?: CalculatorOption[];
  /** Safety flag surfaced whenever this item scores above zero. */
  flag?: string;
};

export type ScoreBand = {
  min: number;
  max: number;
  label: string;
  tone: CalculatorTone;
  guidance: string;
};

export type CalculatorDomain = "mood" | "anxiety" | "substance" | "risk" | "distress";

export type CalculatorFixture = {
  id: string;
  abbrev: string;
  name: string;
  domain: CalculatorDomain;
  icon: LucideIcon;
  /** When to reach for this tool. */
  indication: string;
  /** One-line summary for cards and rails. */
  summary: string;
  /** Question stem shown above the items. */
  stem?: string;
  timeEstimate: string;
  minScore: number;
  maxScore: number;
  items: CalculatorItem[];
  bands: ScoreBand[];
  /** How to read the number, shown with the result. */
  scoringNote: string;
  source: string;
  caution?: string;
};

export const domainLabels: Record<CalculatorDomain, string> = {
  mood: "Mood",
  anxiety: "Anxiety & OCD",
  substance: "Substance use",
  risk: "Suicide risk",
  distress: "General distress",
};

export const domainIcons: Record<CalculatorDomain, LucideIcon> = {
  mood: CloudRain,
  anxiety: Zap,
  substance: Wine,
  risk: ShieldAlert,
  distress: Activity,
};

const frequency0to3: CalculatorOption[] = [
  { label: "Not at all", short: "0", points: 0 },
  { label: "Several days", short: "1", points: 1 },
  { label: "More than half the days", short: "2", points: 2 },
  { label: "Nearly every day", short: "3", points: 3 },
];

const kessler1to5: CalculatorOption[] = [
  { label: "None of the time", short: "1", points: 1 },
  { label: "A little of the time", short: "2", points: 2 },
  { label: "Some of the time", short: "3", points: 3 },
  { label: "Most of the time", short: "4", points: 4 },
  { label: "All of the time", short: "5", points: 5 },
];

const ybocsSeverity: CalculatorOption[] = [
  { label: "None", short: "0", points: 0 },
  { label: "Mild", short: "1", points: 1 },
  { label: "Moderate", short: "2", points: 2 },
  { label: "Severe", short: "3", points: 3 },
  { label: "Extreme", short: "4", points: 4 },
];

export const calculators: CalculatorFixture[] = [
  {
    id: "phq9",
    abbrev: "PHQ-9",
    name: "Patient Health Questionnaire-9",
    domain: "mood",
    icon: CloudRain,
    indication: "Screen for depression, grade severity, and track response to treatment over time.",
    summary: "9-item depression severity score with treatment-action bands.",
    stem: "Over the last 2 weeks, how often have you been bothered by:",
    timeEstimate: "2–3 min",
    minScore: 0,
    maxScore: 27,
    scoringNote: "Sum of 9 items (0–3 each). Severity bands map to stepped treatment actions.",
    source: "Kroenke, Spitzer & Williams 2001",
    caution: "Any endorsement of item 9 requires direct suicide-risk assessment regardless of total score.",
    items: [
      { id: "p1", kind: "options", options: frequency0to3, text: "Little interest or pleasure in doing things" },
      { id: "p2", kind: "options", options: frequency0to3, text: "Feeling down, depressed, or hopeless" },
      {
        id: "p3",
        kind: "options",
        options: frequency0to3,
        text: "Trouble falling or staying asleep, or sleeping too much",
      },
      { id: "p4", kind: "options", options: frequency0to3, text: "Feeling tired or having little energy" },
      { id: "p5", kind: "options", options: frequency0to3, text: "Poor appetite or overeating" },
      {
        id: "p6",
        kind: "options",
        options: frequency0to3,
        text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      },
      {
        id: "p7",
        kind: "options",
        options: frequency0to3,
        text: "Trouble concentrating on things, such as reading or watching television",
      },
      {
        id: "p8",
        kind: "options",
        options: frequency0to3,
        text: "Moving or speaking noticeably slowly — or the opposite, being unusually fidgety or restless",
      },
      {
        id: "p9",
        kind: "options",
        options: frequency0to3,
        text: "Thoughts that you would be better off dead, or of hurting yourself in some way",
        flag: "Item 9 endorsed — complete a structured suicide-risk assessment now.",
      },
    ],
    bands: [
      { min: 0, max: 4, label: "Minimal", tone: "success", guidance: "Monitor; treatment may not be required." },
      { min: 5, max: 9, label: "Mild", tone: "info", guidance: "Watchful waiting; repeat PHQ-9 at follow-up." },
      {
        min: 10,
        max: 14,
        label: "Moderate",
        tone: "warning",
        guidance: "Treatment plan: psychotherapy, follow-up and/or pharmacotherapy.",
      },
      {
        min: 15,
        max: 19,
        label: "Moderately severe",
        tone: "warning",
        guidance: "Active treatment with pharmacotherapy and/or psychotherapy.",
      },
      {
        min: 20,
        max: 27,
        label: "Severe",
        tone: "danger",
        guidance: "Initiate pharmacotherapy; expedite specialist referral if impairment is severe.",
      },
    ],
  },
  {
    id: "gad7",
    abbrev: "GAD-7",
    name: "Generalised Anxiety Disorder-7",
    domain: "anxiety",
    icon: Zap,
    indication: "Screen for generalised anxiety and grade severity; scores ≥10 warrant further assessment.",
    summary: "7-item anxiety severity score; also performs well for panic and social anxiety.",
    stem: "Over the last 2 weeks, how often have you been bothered by:",
    timeEstimate: "1–2 min",
    minScore: 0,
    maxScore: 21,
    scoringNote: "Sum of 7 items (0–3 each). ≥10 is the usual cut-point for probable GAD.",
    source: "Spitzer et al. 2006",
    items: [
      { id: "g1", kind: "options", options: frequency0to3, text: "Feeling nervous, anxious, or on edge" },
      { id: "g2", kind: "options", options: frequency0to3, text: "Not being able to stop or control worrying" },
      { id: "g3", kind: "options", options: frequency0to3, text: "Worrying too much about different things" },
      { id: "g4", kind: "options", options: frequency0to3, text: "Trouble relaxing" },
      { id: "g5", kind: "options", options: frequency0to3, text: "Being so restless that it is hard to sit still" },
      { id: "g6", kind: "options", options: frequency0to3, text: "Becoming easily annoyed or irritable" },
      { id: "g7", kind: "options", options: frequency0to3, text: "Feeling afraid, as if something awful might happen" },
    ],
    bands: [
      { min: 0, max: 4, label: "Minimal", tone: "success", guidance: "No action beyond routine care." },
      { min: 5, max: 9, label: "Mild", tone: "info", guidance: "Monitor; repeat GAD-7 at review." },
      {
        min: 10,
        max: 14,
        label: "Moderate",
        tone: "warning",
        guidance: "Probable anxiety disorder — confirm diagnosis and agree a treatment plan.",
      },
      {
        min: 15,
        max: 21,
        label: "Severe",
        tone: "danger",
        guidance: "Active treatment warranted; assess functional impact and comorbid depression.",
      },
    ],
  },
  {
    id: "k10",
    abbrev: "K10",
    name: "Kessler Psychological Distress Scale",
    domain: "distress",
    icon: Activity,
    indication:
      "Measure non-specific psychological distress over the past 4 weeks; standard for Australian mental-health care plans.",
    summary: "10-item distress measure scored 10–50, widely used across Australian primary care.",
    stem: "In the past 4 weeks, about how often did you feel:",
    timeEstimate: "2–3 min",
    minScore: 10,
    maxScore: 50,
    scoringNote: "Sum of 10 items (1–5 each); range 10–50. Higher scores indicate greater distress.",
    source: "Kessler et al. 2002 · ABS scoring",
    items: [
      { id: "k1", kind: "options", options: kessler1to5, text: "Tired out for no good reason" },
      { id: "k2", kind: "options", options: kessler1to5, text: "Nervous" },
      { id: "k3", kind: "options", options: kessler1to5, text: "So nervous that nothing could calm you down" },
      { id: "k4", kind: "options", options: kessler1to5, text: "Hopeless" },
      { id: "k5", kind: "options", options: kessler1to5, text: "Restless or fidgety" },
      { id: "k6", kind: "options", options: kessler1to5, text: "So restless you could not sit still" },
      { id: "k7", kind: "options", options: kessler1to5, text: "Depressed" },
      { id: "k8", kind: "options", options: kessler1to5, text: "That everything was an effort" },
      { id: "k9", kind: "options", options: kessler1to5, text: "So sad that nothing could cheer you up" },
      { id: "k10", kind: "options", options: kessler1to5, text: "Worthless" },
    ],
    bands: [
      { min: 10, max: 15, label: "Low", tone: "success", guidance: "Likely well; no specific action." },
      {
        min: 16,
        max: 21,
        label: "Moderate",
        tone: "info",
        guidance: "Consistent with mild distress — brief intervention and review.",
      },
      {
        min: 22,
        max: 29,
        label: "High",
        tone: "warning",
        guidance: "Likely mild-to-moderate mental disorder — structured assessment indicated.",
      },
      {
        min: 30,
        max: 50,
        label: "Very high",
        tone: "danger",
        guidance: "Likely severe disorder — comprehensive assessment and active treatment.",
      },
    ],
  },
  {
    id: "mdq",
    abbrev: "MDQ",
    name: "Mood Disorder Questionnaire",
    domain: "mood",
    icon: Repeat2,
    indication: "Screen for lifetime bipolar-spectrum disorder before starting or reviewing antidepressant treatment.",
    summary: "13 lifetime hypomanic symptoms plus co-occurrence and impairment criteria.",
    stem: "Has there ever been a period of time when you were not your usual self and you…",
    timeEstimate: "3–4 min",
    minScore: 0,
    maxScore: 13,
    scoringNote:
      "Positive screen requires ≥7 symptoms, symptoms clustering in the same period, and moderate-or-serious impairment.",
    source: "Hirschfeld et al. 2000",
    caution: "A positive screen is not a diagnosis — confirm with a structured bipolar-disorder assessment.",
    items: [
      {
        id: "m1",
        kind: "checkbox",
        points: 1,
        text: "…felt so good or hyper that other people thought you were not your normal self, or you got into trouble",
      },
      {
        id: "m2",
        kind: "checkbox",
        points: 1,
        text: "…were so irritable that you shouted at people or started fights",
      },
      { id: "m3", kind: "checkbox", points: 1, text: "…felt much more self-confident than usual" },
      {
        id: "m4",
        kind: "checkbox",
        points: 1,
        text: "…got much less sleep than usual and found you didn't really miss it",
      },
      { id: "m5", kind: "checkbox", points: 1, text: "…were much more talkative or spoke much faster than usual" },
      {
        id: "m6",
        kind: "checkbox",
        points: 1,
        text: "…had thoughts racing through your head that you couldn't slow down",
      },
      {
        id: "m7",
        kind: "checkbox",
        points: 1,
        text: "…were so easily distracted that you had trouble concentrating or staying on track",
      },
      { id: "m8", kind: "checkbox", points: 1, text: "…had much more energy than usual" },
      { id: "m9", kind: "checkbox", points: 1, text: "…were much more active or did many more things than usual" },
      {
        id: "m10",
        kind: "checkbox",
        points: 1,
        text: "…were much more social or outgoing — for example, telephoning friends in the middle of the night",
      },
      { id: "m11", kind: "checkbox", points: 1, text: "…were much more interested in sex than usual" },
      {
        id: "m12",
        kind: "checkbox",
        points: 1,
        text: "…did things that were unusual for you or that other people might have thought excessive, foolish, or risky",
      },
      {
        id: "m13",
        kind: "checkbox",
        points: 1,
        text: "…found that spending money got you or your family into trouble",
      },
      {
        id: "mco",
        kind: "checkbox",
        points: 0,
        text: "Several of these ever happened during the same period of time",
        detail: "Criterion 2 — co-occurrence. Does not add to the symptom count.",
      },
      {
        id: "mimp",
        kind: "options",
        text: "How much of a problem did any of these cause you?",
        detail: "Criterion 3 — impairment. Moderate or serious is required for a positive screen.",
        options: [
          { label: "No problem", short: "None", points: 0 },
          { label: "Minor problem", short: "Minor", points: 0 },
          { label: "Moderate problem", short: "Mod", points: 0 },
          { label: "Serious problem", short: "Serious", points: 0 },
        ],
      },
    ],
    bands: [
      {
        min: 0,
        max: 6,
        label: "Below symptom threshold",
        tone: "success",
        guidance: "Screen negative on symptom count alone.",
      },
      {
        min: 7,
        max: 13,
        label: "Symptom threshold met",
        tone: "warning",
        guidance: "Check co-occurrence and impairment criteria to complete the screen.",
      },
    ],
  },
  {
    id: "cage",
    abbrev: "CAGE",
    name: "CAGE Questionnaire",
    domain: "substance",
    icon: Wine,
    indication: "Rapid 4-question lifetime screen for problem drinking in adults.",
    summary: "Four yes/no questions; two or more positives is a clinically significant screen.",
    timeEstimate: "under 1 min",
    minScore: 0,
    maxScore: 4,
    scoringNote: "1 point per “yes”. ≥2 is a positive screen; follow with AUDIT and drinking history.",
    source: "Ewing 1984",
    items: [
      { id: "c1", kind: "checkbox", points: 1, text: "Have you ever felt you should Cut down on your drinking?" },
      { id: "c2", kind: "checkbox", points: 1, text: "Have people Annoyed you by criticising your drinking?" },
      { id: "c3", kind: "checkbox", points: 1, text: "Have you ever felt bad or Guilty about your drinking?" },
      {
        id: "c4",
        kind: "checkbox",
        points: 1,
        text: "Have you ever had a drink first thing in the morning (Eye-opener) to steady your nerves or get rid of a hangover?",
      },
    ],
    bands: [
      {
        min: 0,
        max: 1,
        label: "Screen negative",
        tone: "success",
        guidance: "Reinforce low-risk drinking guidance; rescreen opportunistically.",
      },
      {
        min: 2,
        max: 4,
        label: "Clinically significant",
        tone: "danger",
        guidance: "Positive screen — take a full drinking history and complete the AUDIT.",
      },
    ],
  },
  {
    id: "auditc",
    abbrev: "AUDIT-C",
    name: "Alcohol Use Disorders Identification Test — Consumption",
    domain: "substance",
    icon: GlassWater,
    indication: "Brief consumption screen for hazardous drinking — the first three AUDIT items.",
    summary: "3 consumption questions scored 0–4 each; sex-specific positive thresholds.",
    timeEstimate: "1 min",
    minScore: 0,
    maxScore: 12,
    scoringNote: "Positive screen at ≥3 for women and ≥4 for men. Higher totals track hazard severity.",
    source: "Bush et al. 1998",
    items: [
      {
        id: "a1",
        kind: "options",
        text: "How often do you have a drink containing alcohol?",
        options: [
          { label: "Never", short: "0", points: 0 },
          { label: "Monthly or less", short: "1", points: 1 },
          { label: "2–4 times a month", short: "2", points: 2 },
          { label: "2–3 times a week", short: "3", points: 3 },
          { label: "4+ times a week", short: "4", points: 4 },
        ],
      },
      {
        id: "a2",
        kind: "options",
        text: "How many standard drinks do you have on a typical day when you are drinking?",
        options: [
          { label: "1–2", short: "0", points: 0 },
          { label: "3–4", short: "1", points: 1 },
          { label: "5–6", short: "2", points: 2 },
          { label: "7–9", short: "3", points: 3 },
          { label: "10 or more", short: "4", points: 4 },
        ],
      },
      {
        id: "a3",
        kind: "options",
        text: "How often do you have six or more standard drinks on one occasion?",
        options: [
          { label: "Never", short: "0", points: 0 },
          { label: "Less than monthly", short: "1", points: 1 },
          { label: "Monthly", short: "2", points: 2 },
          { label: "Weekly", short: "3", points: 3 },
          { label: "Daily or almost daily", short: "4", points: 4 },
        ],
      },
    ],
    bands: [
      { min: 0, max: 2, label: "Lower risk", tone: "success", guidance: "Below screening threshold for both sexes." },
      {
        min: 3,
        max: 4,
        label: "At threshold",
        tone: "warning",
        guidance: "Positive for women at ≥3 and men at ≥4 — brief intervention and full AUDIT.",
      },
      {
        min: 5,
        max: 12,
        label: "Higher risk",
        tone: "danger",
        guidance: "Likely hazardous or harmful drinking — full AUDIT, brief intervention, consider referral.",
      },
    ],
  },
  {
    id: "sadpersons",
    abbrev: "SAD PERSONS",
    name: "SAD PERSONS Scale",
    domain: "risk",
    icon: ShieldAlert,
    indication: "Structure a rapid inventory of static suicide-risk factors as an adjunct to clinical assessment.",
    summary: "10 yes/no risk factors, one point each; supports — never replaces — clinical judgement.",
    timeEstimate: "1–2 min",
    minScore: 0,
    maxScore: 10,
    scoringNote: "1 point per factor present. Bands are indicative only; act on clinical concern at any score.",
    source: "Patterson et al. 1983",
    caution:
      "Risk scales have poor predictive value. Use to prompt a structured risk assessment, not to gate disposition decisions.",
    items: [
      { id: "s1", kind: "checkbox", points: 1, text: "Sex — male" },
      { id: "s2", kind: "checkbox", points: 1, text: "Age — under 19 or over 45" },
      { id: "s3", kind: "checkbox", points: 1, text: "Depression — current low mood or diagnosed depressive episode" },
      { id: "s4", kind: "checkbox", points: 1, text: "Previous suicide attempt or psychiatric care" },
      { id: "s5", kind: "checkbox", points: 1, text: "Excess alcohol or substance use" },
      { id: "s6", kind: "checkbox", points: 1, text: "Rational thinking loss — psychosis or organic impairment" },
      { id: "s7", kind: "checkbox", points: 1, text: "Separated, widowed, or divorced" },
      {
        id: "s8",
        kind: "checkbox",
        points: 1,
        text: "Organised or serious attempt / plan",
        flag: "Organised plan endorsed — escalate to a full structured risk assessment now.",
      },
      { id: "s9", kind: "checkbox", points: 1, text: "No social supports" },
      { id: "s10", kind: "checkbox", points: 1, text: "Stated future intent to repeat or ambivalence about survival" },
    ],
    bands: [
      {
        min: 0,
        max: 4,
        label: "Lower indicative risk",
        tone: "info",
        guidance: "Consider discharge with follow-up if the clinical assessment agrees.",
      },
      {
        min: 5,
        max: 6,
        label: "Intermediate",
        tone: "warning",
        guidance: "Consider close follow-up or admission; complete a structured risk assessment.",
      },
      {
        min: 7,
        max: 10,
        label: "Higher indicative risk",
        tone: "danger",
        guidance: "Admission usually indicated; ensure immediate safety planning.",
      },
    ],
  },
  {
    id: "ybocs",
    abbrev: "Y-BOCS",
    name: "Yale-Brown Obsessive Compulsive Scale — Severity",
    domain: "anxiety",
    icon: Brain,
    indication: "Grade the severity of obsessive-compulsive symptoms and track treatment response.",
    summary: "10 severity items (0–4) across obsessions and compulsions; total 0–40.",
    timeEstimate: "5–8 min",
    minScore: 0,
    maxScore: 40,
    scoringNote: "Sum of 10 items. Items 1–5 grade obsessions, 6–10 compulsions; subscales can be reported separately.",
    source: "Goodman et al. 1989",
    items: [
      { id: "y1", kind: "options", options: ybocsSeverity, text: "Time occupied by obsessive thoughts" },
      { id: "y2", kind: "options", options: ybocsSeverity, text: "Interference from obsessive thoughts" },
      { id: "y3", kind: "options", options: ybocsSeverity, text: "Distress associated with obsessive thoughts" },
      {
        id: "y4",
        kind: "options",
        options: ybocsSeverity,
        text: "Resistance against obsessions",
        detail: "0 = always resists",
      },
      { id: "y5", kind: "options", options: ybocsSeverity, text: "Degree of control over obsessive thoughts" },
      { id: "y6", kind: "options", options: ybocsSeverity, text: "Time spent performing compulsive behaviours" },
      { id: "y7", kind: "options", options: ybocsSeverity, text: "Interference from compulsive behaviours" },
      { id: "y8", kind: "options", options: ybocsSeverity, text: "Distress if compulsions are prevented" },
      {
        id: "y9",
        kind: "options",
        options: ybocsSeverity,
        text: "Resistance against compulsions",
        detail: "0 = always resists",
      },
      { id: "y10", kind: "options", options: ybocsSeverity, text: "Degree of control over compulsive behaviour" },
    ],
    bands: [
      { min: 0, max: 7, label: "Subclinical", tone: "success", guidance: "Symptoms below the clinical range." },
      { min: 8, max: 15, label: "Mild", tone: "info", guidance: "Consider CBT with exposure and response prevention." },
      {
        min: 16,
        max: 23,
        label: "Moderate",
        tone: "warning",
        guidance: "Active treatment: ERP and/or SSRI at adequate dose.",
      },
      {
        min: 24,
        max: 31,
        label: "Severe",
        tone: "danger",
        guidance: "Intensive treatment; review augmentation options.",
      },
      {
        min: 32,
        max: 40,
        label: "Extreme",
        tone: "danger",
        guidance: "Specialist OCD service involvement recommended.",
      },
    ],
  },
];

export const calculatorById = (id: string): CalculatorFixture => {
  const found = calculators.find((calc) => calc.id === id);
  if (!found) throw new Error(`Unknown calculator fixture: ${id}`);
  return found;
};

export const domainOrder: CalculatorDomain[] = ["mood", "anxiety", "substance", "risk", "distress"];

/** Extra directory entries shown as "coming soon" in directory-style mockups. */
export const plannedCalculators: { abbrev: string; name: string; indication: string; icon: LucideIcon }[] = [
  {
    abbrev: "CIWA-Ar",
    name: "Clinical Institute Withdrawal Assessment — Alcohol",
    indication: "Grade alcohol-withdrawal severity and drive symptom-triggered dosing.",
    icon: HeartPulse,
  },
  {
    abbrev: "EPDS",
    name: "Edinburgh Postnatal Depression Scale",
    indication: "Screen for depression in the perinatal period.",
    icon: Baby,
  },
  {
    abbrev: "COWS",
    name: "Clinical Opiate Withdrawal Scale",
    indication: "Grade opioid-withdrawal severity before induction.",
    icon: AlertTriangle,
  },
];
