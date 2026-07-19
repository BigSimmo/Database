import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import therapiesIndexJson from "../src/data/therapies-index.json";

// Guards the clinical integrity of the Therapy Compass pathway data. The imported
// mockup shipped pathways whose therapy steps were mismatched to the pathway's
// clinical problem (e.g. Crisis/risk -> "ERP for tics", Grief/loss -> eating-disorder
// therapies). Those mappings were re-curated; this suite stops the mismatch class
// from recurring by asserting every step references a therapy that (a) exists and
// (b) is clinically appropriate for that pathway's clinicalProblem.

type Therapy = { slug: string; bestUsedFor: string };
type Step = { therapySlug: string; label: string; description: string };
type Pathway = { slug: string; clinicalProblem: string; steps: Step[] };

const dataUrl = (name: string) => new URL(`../public/therapy-compass-data/${name}`, import.meta.url);

const therapies = JSON.parse(readFileSync(dataUrl("therapies.json"), "utf8")) as Therapy[];
const pathways = JSON.parse(readFileSync(dataUrl("pathways.json"), "utf8")) as Pathway[];
const bySlug = new Map(therapies.map((t) => [t.slug, t]));
const canonicalBySlug = new Map(therapiesIndexJson.map((therapy) => [therapy.slug, therapy]));
const LEGACY_DUPLICATE_SLUGS = [
  "behavioural-activation",
  "emdr",
  "interpersonal-therapy",
  "mindfulness-based-cognitive-therapy",
  "problem-solving-therapy",
  "prolonged-exposure-therapy",
];

// Independent clinical allowlist: for each pathway clinical problem, the set of
// catalogue therapies that genuinely treat it. This is the source of truth the
// pathway steps are checked against — a therapy outside its pathway's set is a
// clinical mismatch, regardless of the (noisy, over-broad) per-therapy tags.
const DOMAIN_APPROPRIATE: Record<string, string[]> = {
  Anxiety: [
    "cognitive-behavioural-therapy-cbt",
    "cognitive-therapy",
    "behaviour-therapy",
    "graded-exposure",
    "exposure-therapy",
    "exposure-based-cbt-exposure-therapy",
    "exposure-and-response-prevention-erp",
    "interoceptive-exposure",
    "applied-relaxation-relaxation-based-therapy",
    "worry-focused-cbt",
    "panic-focused-cbt",
    "social-anxiety-focused-cbt",
    "health-anxiety-focused-cbt",
    "metacognitive-therapy-mct",
    "acceptance-and-commitment-therapy-act",
    "mindfulness-based-cognitive-therapy-mbct",
    "problem-solving-therapy-pst",
    "coping-skills-interventions",
    "psychoeducation",
    "internet-delivered-cbt",
    "brief-low-intensity-cbt",
    "guided-self-help",
    "group-exposure-programmes",
  ],
  "Crisis/risk": [
    "crisis-intervention-crisis-oriented-brief-therapy",
    "cbt-informed-psychological-intervention-for-self-harm",
    "problem-solving-therapy-pst",
    "dialectical-behaviour-therapy-dbt",
    "developmentally-adapted-dbt",
    "dbt-skills-groups",
    "coping-skills-interventions",
    "brief-supportive-psychotherapy",
    "supportive-psychotherapy",
    "structured-clinical-management",
    "good-psychiatric-management",
    "psychoeducation",
  ],
  "Eating/body image": [
    "eating-disorder-focused-cognitive-behavioural-therapy-cbt-ed-cbt-e",
    "family-based-treatment-for-adolescent-anorexia-nervosa-ft-an",
    "family-based-treatment-for-bulimia-nervosa-ft-bn",
    "guided-self-help-for-binge-eating-disorder",
    "guided-self-help-for-bulimia-nervosa",
    "maudsley-anorexia-nervosa-treatment-for-adults-mantra",
    "specialist-supportive-clinical-management-sscm",
    "adolescent-focused-psychotherapy-for-anorexia-nervosa",
    "carer-supported-meal-based-interventions",
    "dbt-informed-adjunctive-emotion-regulation-work-for-eating-disorders",
    "eating-disorder-focused-focal-psychodynamic-therapy-fpt-for-adult-anorexia-nervosa",
  ],
  "Grief/loss": [
    "interpersonal-psychotherapy-ipt",
    "meaning-centred-psychotherapy",
    "brief-supportive-psychotherapy",
    "supportive-psychotherapy",
    "life-review-therapy-reminiscence-therapy",
    "dignity-therapy",
    "emotion-focused-therapy",
    "existential-psychotherapy",
    "compassion-focused-therapy",
    "narrative-therapy",
    "person-centred-rogerian-therapy",
  ],
  Mood: [
    "cognitive-behavioural-therapy-cbt",
    "behavioural-activation-ba",
    "interpersonal-psychotherapy-ipt",
    "problem-solving-therapy-pst",
    "mindfulness-based-cognitive-therapy-mbct",
    "short-term-psychodynamic-psychotherapy-for-depression-stpp",
    "supportive-expressive-psychodynamic-counselling-approaches-for-depression",
    "cognitive-therapy",
    "relapse-prevention-psychotherapy",
    "psychoeducation",
  ],
  Neurodevelopmental: [
    "behavioural-parent-training",
    "parent-management-training-pmt",
    "parent-training",
    "parent-and-child-training",
    "social-communication-parent-mediated-autism-interventions",
    "developmental-social-skills-interventions",
    "neurodevelopmentally-adapted-psychosocial-interventions",
    "parent-child-interaction-therapy-pcit",
    "developmentally-adapted-erp",
    "developmentally-adapted-dbt",
    "child-cbt",
    "adolescent-cbt",
  ],
  "Pain/somatic": [
    "acceptance-and-commitment-therapy-act",
    "cognitive-behavioural-therapy-cbt",
    "health-anxiety-focused-cbt",
    "mindfulness-based-stress-reduction",
    "applied-relaxation-relaxation-based-therapy",
    "mindfulness-based-cognitive-therapy-mbct",
    "interoceptive-exposure",
    "problem-solving-therapy-pst",
    "psychoeducation",
  ],
  "Personality/interpersonal": [
    "dialectical-behaviour-therapy-dbt",
    "mentalisation-based-therapy-mbt",
    "schema-therapy",
    "structured-clinical-management",
    "good-psychiatric-management",
    "transference-focused-psychotherapy-tfp",
    "cognitive-analytic-therapy-cat",
    "psychodynamic-psychotherapy",
    "relational-psychodynamic-therapies",
    "dynamic-interpersonal-therapy",
    "interpersonal-psychotherapy-ipt",
  ],
  Psychosis: [
    "cognitive-behavioural-therapy-for-psychosis-cbtp",
    "family-intervention-for-psychosis",
    "family-psychoeducation-for-psychosis",
    "psychoeducation-for-psychosis",
    "cognitive-remediation-therapy-crt",
    "illness-management-and-recovery-style-interventions-imr-style-interventions",
    "supported-employment-individual-placement-and-support-ips",
    "social-skills-training-sst",
    "social-cognition-training",
    "recovery-oriented-psychosocial-interventions",
    "carer-focused-education-and-support-carer-psychoeducation-in-psychosis",
  ],
  Sleep: [
    "cognitive-behavioural-therapy-for-insomnia-cbt-i",
    "cognitive-behavioural-therapy-for-insomnia",
    "sleep-compression-therapy-for-insomnia",
    "mindfulness-based-therapy-for-insomnia-mbti",
    "imagery-rehearsal-therapy-irt-for-nightmare-disorder",
    "bright-light-therapy",
    "circadian-rhythm-based-interventions",
    "wake-therapy-sleep-deprivation-chronotherapy",
  ],
  "Substance use": [
    "motivational-interviewing-mi-for-substance-use-disorders",
    "motivational-interviewing",
    "motivational-enhancement-therapy-met",
    "relapse-prevention-therapy-for-substance-use-disorders",
    "contingency-management-cm",
    "community-reinforcement-approach",
    "community-reinforcement-and-family-training-craft",
    "mindfulness-based-relapse-prevention-mbrp",
    "twelve-step-facilitation-tsf",
    "matrix-model",
    "cue-exposure-therapy-cet-for-substance-use-disorders",
    "integrated-dual-diagnosis-psychotherapy",
    "harm-reduction-counselling",
  ],
  Trauma: [
    "trauma-focused-cognitive-behavioural-therapy-tf-cbt",
    "eye-movement-desensitisation-and-reprocessing-emdr",
    "cognitive-processing-therapy-cpt",
    "cognitive-therapy-for-ptsd-ct-ptsd",
    "prolonged-exposure-pe",
    "narrative-exposure-therapy-net",
    "written-exposure-therapy",
    "phase-oriented-trauma-therapy",
    "seeking-safety",
    "stair-skills-training-in-affective-and-interpersonal-regulation",
  ],
};

describe("Therapy Compass pathway clinical integrity", () => {
  it("keeps legacy duplicate therapy slugs out of the canonical catalogue", () => {
    for (const slug of LEGACY_DUPLICATE_SLUGS) {
      expect(canonicalBySlug.has(slug), `legacy duplicate therapy ${slug} was restored in therapies-index.json`).toBe(
        false,
      );
      expect(bySlug.has(slug), `legacy duplicate therapy ${slug} was restored in therapies.json`).toBe(false);
    }
  });

  it("covers every pathway clinical problem with an allowlist", () => {
    for (const p of pathways) {
      expect(DOMAIN_APPROPRIATE[p.clinicalProblem], `no allowlist for ${p.clinicalProblem}`).toBeTruthy();
    }
  });

  it("references only therapies that exist in the catalogue", () => {
    for (const p of pathways) {
      for (const s of p.steps) {
        expect(bySlug.has(s.therapySlug), `${p.slug}: unknown therapy ${s.therapySlug}`).toBe(true);
      }
    }
  });

  it("recommends only therapies clinically appropriate to each pathway's problem", () => {
    for (const p of pathways) {
      const allowed = new Set(DOMAIN_APPROPRIATE[p.clinicalProblem] ?? []);
      for (const s of p.steps) {
        expect(
          allowed.has(s.therapySlug),
          `${p.slug} (${p.clinicalProblem}) recommends "${s.therapySlug}", which is not clinically indexed to that problem`,
        ).toBe(true);
      }
    }
  });

  it("keeps each step's description source-grounded to its therapy", () => {
    for (const p of pathways) {
      for (const s of p.steps) {
        const t = bySlug.get(s.therapySlug);
        expect(s.description, `${p.slug}: ${s.therapySlug} description drifted from source`).toBe(t?.bestUsedFor);
      }
    }
  });

  it("gives every pathway an ordered set of options led by an initial option", () => {
    for (const p of pathways) {
      expect(p.steps.length, `${p.slug} has no steps`).toBeGreaterThan(0);
      expect(p.steps[0].label, `${p.slug} does not lead with an initial option`).toBe("Initial option");
    }
  });

  it("does not resurrect the known cross-domain mismatches", () => {
    const bySlugPathway = Object.fromEntries(pathways.map((p) => [p.slug, p.steps.map((s) => s.therapySlug)]));
    expect(bySlugPathway["crisis-risk-pathway"]).not.toContain(
      "exposure-and-response-prevention-for-tics-erp-for-tics",
    );
    expect(bySlugPathway["pain-somatic-pathway"]).not.toContain(
      "exposure-and-response-prevention-for-tics-erp-for-tics",
    );
    expect(bySlugPathway["grief-loss-pathway"]).not.toContain("vocational-rehabilitation");
    expect(bySlugPathway["grief-loss-pathway"]).not.toContain(
      "family-based-treatment-for-adolescent-anorexia-nervosa-ft-an",
    );
  });
});
