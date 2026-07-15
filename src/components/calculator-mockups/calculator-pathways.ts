import type { CalculatorFixture } from "./calculator-fixtures";
import type { DerivedCalculator } from "./calculator-ui";

/**
 * Score-driven pathway content for the search/detail mockup: what to do next
 * at the current severity band, and which knowledge-base content to surface.
 * Mockup fixtures only — production would resolve `related` through the live
 * retrieval index instead of hand-authored hrefs.
 */

export type PathwayAction = {
  label: string;
  detail?: string;
};

export type RelatedKind = "guideline" | "medication" | "differential" | "service" | "form" | "answer" | "calculator";

export type RelatedItem = {
  title: string;
  kind: RelatedKind;
  /** Route within the app; ignored for kind "calculator". */
  href?: string;
  /** For kind "calculator": switch to this scale in place. */
  calcId?: string;
  note?: string;
  /** Only show once the current band index reaches this value (0-based). */
  minBandIndex?: number;
};

export const relatedKindLabels: Record<RelatedKind, string> = {
  guideline: "Guideline",
  medication: "Medication",
  differential: "Differential",
  service: "Service",
  form: "Form",
  answer: "Ask",
  calculator: "Calculator",
};

type CalculatorPathway = {
  /** Parallel to calc.bands; falls back to the band guidance sentence. */
  bandActions?: PathwayAction[][];
  related: RelatedItem[];
};

const pathways: Record<string, CalculatorPathway> = {
  phq9: {
    bandActions: [
      [
        { label: "Reassure and reinforce sleep, activity, and alcohol basics" },
        { label: "Rescreen if the clinical picture changes" },
      ],
      [
        { label: "Watchful waiting with psychoeducation" },
        { label: "Repeat PHQ-9 in 2–4 weeks", detail: "Track the trend, not the single score" },
        { label: "Consider low-intensity psychological therapy" },
      ],
      [
        { label: "Confirm DSM-5 criteria for a major depressive episode" },
        { label: "Start psychological therapy; consider an SSRI" },
        { label: "Screen for bipolarity before any antidepressant", detail: "Run the MDQ below" },
      ],
      [
        { label: "Active treatment: pharmacotherapy and/or psychotherapy" },
        { label: "Screen for bipolarity before prescribing", detail: "Run the MDQ below" },
        { label: "Safety-net and book review within 1–2 weeks" },
      ],
      [
        { label: "Initiate pharmacotherapy; consider psychiatry referral" },
        { label: "Assess psychotic features and ECT indications" },
        { label: "Complete a structured suicide-risk assessment now" },
      ],
    ],
    related: [
      {
        title: "Major depression — stepped treatment pathway",
        kind: "guideline",
        href: "/documents/search?q=major+depression+treatment+pathway",
      },
      {
        title: "Sertraline — initiation and monitoring",
        kind: "medication",
        href: "/medications/sertraline",
        minBandIndex: 2,
      },
      { title: "Low mood — differential diagnoses", kind: "differential", href: "/differentials" },
      { title: "Mental health treatment plan", kind: "form", href: "/forms", minBandIndex: 1 },
      {
        title: "Acute mental health team referral",
        kind: "service",
        href: "/services",
        minBandIndex: 3,
      },
      {
        title: "ECT consent requirements",
        kind: "answer",
        href: "/?mode=answer&q=ECT+consent+requirements",
        minBandIndex: 4,
      },
      { title: "MDQ — bipolar screen before antidepressants", kind: "calculator", calcId: "mdq", minBandIndex: 2 },
    ],
  },
  gad7: {
    bandActions: [
      [{ label: "No action beyond routine care" }],
      [{ label: "Psychoeducation and active monitoring" }, { label: "Repeat GAD-7 at next review" }],
      [
        { label: "Confirm the anxiety diagnosis and rule out mimics", detail: "Thyroid, stimulants, withdrawal" },
        { label: "Refer for CBT; consider an SSRI" },
        { label: "Co-screen for depression", detail: "Run the PHQ-9 below" },
      ],
      [
        { label: "Active treatment: CBT and/or SSRI at adequate dose" },
        { label: "Assess functional impact and comorbid depression" },
        { label: "Avoid initiating benzodiazepines for chronic anxiety" },
      ],
    ],
    related: [
      {
        title: "Generalised anxiety — management pathway",
        kind: "guideline",
        href: "/documents/search?q=generalised+anxiety+management",
      },
      {
        title: "Escitalopram — dosing and cautions",
        kind: "medication",
        href: "/medications/escitalopram",
        minBandIndex: 2,
      },
      { title: "Anxiety — differential diagnoses", kind: "differential", href: "/differentials" },
      {
        title: "Benzodiazepine deprescribing",
        kind: "answer",
        href: "/?mode=answer&q=benzodiazepine+deprescribing",
        minBandIndex: 3,
      },
      { title: "PHQ-9 — depression co-screen", kind: "calculator", calcId: "phq9", minBandIndex: 2 },
    ],
  },
  k10: {
    bandActions: [
      [{ label: "Likely well — no specific action" }],
      [{ label: "Brief intervention and lifestyle advice" }, { label: "Repeat K10 at follow-up" }],
      [
        { label: "Structured assessment for anxiety and depression", detail: "PHQ-9 and GAD-7 below" },
        { label: "Consider a mental health treatment plan" },
      ],
      [
        { label: "Comprehensive assessment and active treatment" },
        { label: "Prepare a mental health treatment plan and referral" },
        { label: "Assess suicide risk directly" },
      ],
    ],
    related: [
      { title: "Mental health treatment plan", kind: "form", href: "/forms", minBandIndex: 2 },
      {
        title: "Psychological distress — stepped care",
        kind: "guideline",
        href: "/documents/search?q=stepped+care+psychological+distress",
      },
      { title: "PHQ-9 — depression severity", kind: "calculator", calcId: "phq9", minBandIndex: 2 },
      { title: "GAD-7 — anxiety severity", kind: "calculator", calcId: "gad7", minBandIndex: 2 },
    ],
  },
  mdq: {
    related: [
      {
        title: "Bipolar disorder — assessment and referral",
        kind: "guideline",
        href: "/documents/search?q=bipolar+disorder+assessment",
      },
      {
        title: "Lithium — initiation and monitoring",
        kind: "medication",
        href: "/medications/lithium-carbonate-ir-sr",
        minBandIndex: 1,
      },
      { title: "Elevated mood — differential diagnoses", kind: "differential", href: "/differentials" },
      { title: "PHQ-9 — current depressive severity", kind: "calculator", calcId: "phq9" },
    ],
  },
  cage: {
    bandActions: [
      [{ label: "Reinforce low-risk drinking guidance" }, { label: "Rescreen opportunistically" }],
      [
        { label: "Take a full drinking history" },
        { label: "Complete the full AUDIT", detail: "AUDIT-C below covers consumption only" },
        { label: "Brief intervention; assess dependence and withdrawal risk" },
        { label: "Consider thiamine if dependence is likely" },
      ],
    ],
    related: [
      { title: "AUDIT-C — consumption screen", kind: "calculator", calcId: "auditc" },
      {
        title: "Alcohol withdrawal management",
        kind: "guideline",
        href: "/documents/search?q=alcohol+withdrawal+management",
        minBandIndex: 1,
      },
      { title: "Thiamine — Wernicke prophylaxis", kind: "medication", href: "/medications/thiamine", minBandIndex: 1 },
      { title: "Drug and alcohol service referral", kind: "service", href: "/services", minBandIndex: 1 },
    ],
  },
  auditc: {
    bandActions: [
      [{ label: "Below screening threshold — reinforce low-risk limits" }],
      [
        { label: "Positive for women at ≥3, men at ≥4 — brief intervention" },
        { label: "Complete the full 10-item AUDIT" },
      ],
      [
        { label: "Likely hazardous or harmful drinking — full AUDIT" },
        { label: "Brief intervention; assess dependence and withdrawal risk" },
        { label: "Consider drug and alcohol service referral" },
      ],
    ],
    related: [
      {
        title: "Alcohol — brief intervention guide",
        kind: "guideline",
        href: "/documents/search?q=alcohol+brief+intervention",
      },
      { title: "CAGE — dependence signal check", kind: "calculator", calcId: "cage" },
      { title: "Drug and alcohol service referral", kind: "service", href: "/services", minBandIndex: 2 },
      {
        title: "Safe drinking limits",
        kind: "answer",
        href: "/?mode=answer&q=safe+drinking+limits+australia",
      },
    ],
  },
  sadpersons: {
    bandActions: [
      [
        { label: "Complete a structured risk assessment regardless of score" },
        { label: "Safety plan and follow-up if discharging" },
      ],
      [
        { label: "Structured risk assessment now" },
        { label: "Consider admission or intensive community follow-up" },
        { label: "Involve family or carers where safe to do so" },
      ],
      [
        { label: "Admission usually indicated — ensure immediate safety" },
        { label: "Continuous observation while in the department" },
        { label: "Structured risk assessment and psychiatry review" },
      ],
    ],
    related: [
      {
        title: "Suicide risk assessment framework",
        kind: "guideline",
        href: "/documents/search?q=suicide+risk+assessment+framework",
      },
      { title: "Safety planning template", kind: "form", href: "/forms" },
      { title: "13YARN — crisis support referral", kind: "service", href: "/services" },
      { title: "Acute mental health team", kind: "service", href: "/services", minBandIndex: 1 },
    ],
  },
  ybocs: {
    related: [
      {
        title: "OCD — exposure and response prevention",
        kind: "guideline",
        href: "/documents/search?q=OCD+exposure+response+prevention",
      },
      {
        title: "Sertraline — higher-dose OCD treatment",
        kind: "medication",
        href: "/medications/sertraline",
        minBandIndex: 2,
      },
      {
        title: "SSRI augmentation in OCD",
        kind: "answer",
        href: "/?mode=answer&q=SSRI+augmentation+OCD",
        minBandIndex: 3,
      },
    ],
  },
};

/** Actions for the current band — falls back to the band's guidance sentence. */
export function actionsForBand(calc: CalculatorFixture, derived: DerivedCalculator): PathwayAction[] {
  const bandIndex = derived.band ? calc.bands.indexOf(derived.band) : -1;
  if (bandIndex < 0) return [];
  const custom = pathways[calc.id]?.bandActions?.[bandIndex];
  if (custom?.length) return custom;
  return derived.result.guidance ? [{ label: derived.result.guidance }] : [];
}

/** Related knowledge-base content visible at the current band. */
export function relatedForBand(calc: CalculatorFixture, derived: DerivedCalculator): RelatedItem[] {
  const bandIndex = derived.band ? calc.bands.indexOf(derived.band) : 0;
  return (pathways[calc.id]?.related ?? []).filter((item) => (item.minBandIndex ?? 0) <= bandIndex);
}
