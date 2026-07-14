import formulationContentJson from "@/data/formulation-content.json";

export type FormulationMechanism = {
  id: string;
  name: string;
  definition: string;
  summary: string;
  coreProcess: string;
  development: string;
  symptoms: string[];
  diagnosticContexts: string[];
  protective: string[];
  caveats: string[];
  fitIndicators: string[];
  poorFitIndicators: string[];
  caseExample: string;
  treatmentTargetExample: string;
  predisposing: string[];
  precipitating: string[];
  perpetuating: string[];
  clinicalClues: string[];
  patientPhrases: string[];
  domains: string[];
  tags: string[];
  maintainingCycles: string[];
  comparisonNotes: string[];
  formulationUse: string;
  exampleSentence: string;
  treatmentImplications: string[];
  treatmentLeverage: string;
  sources: string[];
  sourceStatus: string;
  sourceConfidence: string;
  version: string;
};

export type FormulationTemplate = { id: string; label: string };

export type FormulationSection = {
  id: string;
  label: string;
  prompt: string;
  group: string[];
};

export type FormulationQualityPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export type MechanismComparisonGuide = {
  mostUsefulDistinction: string;
  commonConfusion: string;
  treatmentImplicationDifference: string;
  assessmentQuestion: string;
};

export type FormulationSource = {
  id: string;
  title: string;
  url: string;
};

type FormulationContentBundle = {
  domains: string[];
  mechanisms: FormulationMechanism[];
  formulationTemplates: FormulationTemplate[];
  formulationSections: FormulationSection[];
  formulationQualityPrompts: FormulationQualityPrompt[];
  comparisonGuidance: Record<string, MechanismComparisonGuide>;
  sourceLibrary: Record<string, FormulationSource>;
  sourceWarnings: {
    prototype: string;
    source: string;
    draft: string;
    clipboard: string;
    privacy: string;
    regulatory: string;
  };
};

const formulationContent = formulationContentJson as unknown as FormulationContentBundle;

export const formulationDomains = formulationContent.domains;
export const formulationMechanisms = formulationContent.mechanisms;
export const formulationTemplates = formulationContent.formulationTemplates;
export const formulationSections = formulationContent.formulationSections;
export const formulationQualityPrompts = formulationContent.formulationQualityPrompts;
export const formulationSourceLibrary = formulationContent.sourceLibrary;
export const formulationWarnings = formulationContent.sourceWarnings;

export const formulationSearchPresets = [
  { label: "I keep going over it", query: "I keep going over it" },
  { label: "What if something goes wrong?", query: "What if something goes wrong?" },
  { label: "Zero to one hundred", query: "It goes from zero to one hundred" },
  { label: "I do not need anyone", query: "I do not need anyone" },
  { label: "If it is not perfect", query: "If it is not perfect, it is a failure" },
] as const;

export const formulationDomainGroups = [
  {
    id: "meaning",
    label: "Meaning and belief",
    description: "How experience is interpreted and organised.",
    domains: ["Cognition", "Developmental", "Cultural"],
  },
  {
    id: "emotion",
    label: "Emotion and threat",
    description: "Affect, trauma responses, and risk-relevant escalation.",
    domains: ["Affect", "Trauma", "Risk", "Biological"],
  },
  {
    id: "response",
    label: "Coping and action",
    description: "What the person does to manage distress or uncertainty.",
    domains: ["Behaviour", "Social"],
  },
  {
    id: "relationship",
    label: "Relationship and protection",
    description: "Attachment strategies, interpersonal patterns, and defences.",
    domains: ["Attachment", "Interpersonal", "Defence"],
  },
] as const;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function findFormulationMechanism(id: string) {
  return formulationMechanisms.find((mechanism) => mechanism.id === id);
}

export function normalizeMechanismSelection(ids: string[]) {
  const knownIds = new Set(formulationMechanisms.map((mechanism) => mechanism.id));
  return unique(ids).filter((id) => knownIds.has(id));
}

export function formulationSectionsForTemplate(templateId: string) {
  return formulationSections.filter((section) => section.group.includes(templateId));
}

export function comparisonGuideFor(leftId: string, rightId: string) {
  const direct = formulationContent.comparisonGuidance[`${leftId}__${rightId}`];
  if (direct) return direct;
  const reverse = formulationContent.comparisonGuidance[`${rightId}__${leftId}`];
  if (!reverse) return undefined;
  return reverse;
}

export function relatedFormulationMechanisms(mechanism: FormulationMechanism, limit = 4) {
  const sourceDomains = new Set(mechanism.domains);
  const sourceSymptoms = new Set(mechanism.symptoms.map(normalize));
  const sourceContexts = new Set(mechanism.diagnosticContexts.map(normalize));

  return formulationMechanisms
    .filter((candidate) => candidate.id !== mechanism.id)
    .map((candidate) => {
      const sharedDomains = candidate.domains.filter((domain) => sourceDomains.has(domain)).length;
      const sharedSymptoms = candidate.symptoms.filter((symptom) => sourceSymptoms.has(normalize(symptom))).length;
      const sharedContexts = candidate.diagnosticContexts.filter((context) =>
        sourceContexts.has(normalize(context)),
      ).length;
      const hasComparisonGuide = Boolean(comparisonGuideFor(mechanism.id, candidate.id));
      return {
        candidate,
        score: sharedDomains * 5 + sharedSymptoms * 3 + sharedContexts * 2 + (hasComparisonGuide ? 20 : 0),
      };
    })
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

function searchText(mechanism: FormulationMechanism) {
  return normalize(
    [
      mechanism.name,
      mechanism.definition,
      mechanism.summary,
      mechanism.coreProcess,
      mechanism.formulationUse,
      ...mechanism.symptoms,
      ...mechanism.diagnosticContexts,
      ...mechanism.domains,
      ...mechanism.tags,
      ...mechanism.clinicalClues,
      ...mechanism.patientPhrases,
      ...mechanism.fitIndicators,
    ].join(" "),
  );
}

export function searchFormulationMechanisms(query: string, options: { domain?: string } = {}) {
  const normalizedQuery = normalize(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  return formulationMechanisms
    .map((mechanism, index) => {
      if (options.domain && options.domain !== "all" && !mechanism.domains.includes(options.domain)) return null;

      const haystack = searchText(mechanism);
      const name = normalize(mechanism.name);
      const phrases = normalize(mechanism.patientPhrases.join(" "));
      const clues = normalize(mechanism.clinicalClues.join(" "));
      const tags = normalize(mechanism.tags.join(" "));
      let score = normalizedQuery ? 0 : formulationMechanisms.length - index;

      if (normalizedQuery) {
        if (name === normalizedQuery) score += 80;
        else if (name.includes(normalizedQuery)) score += 48;
        if (phrases.includes(normalizedQuery)) score += 55;
        if (clues.includes(normalizedQuery)) score += 35;
        if (tags.includes(normalizedQuery)) score += 28;
        for (const token of queryTokens) {
          if (name.includes(token)) score += 14;
          if (phrases.includes(token)) score += 10;
          if (clues.includes(token)) score += 8;
          if (haystack.includes(token)) score += 3;
        }
      }

      return score > 0 ? { mechanism, score } : null;
    })
    .filter((result): result is { mechanism: FormulationMechanism; score: number } => Boolean(result))
    .sort((left, right) => right.score - left.score || left.mechanism.name.localeCompare(right.mechanism.name));
}

export function suggestionsForFormulationSection(mechanisms: FormulationMechanism[], sectionId: string) {
  const bySection: Record<string, string[]> = {
    symptoms: mechanisms.flatMap((mechanism) => mechanism.symptoms),
    predisposing: mechanisms.flatMap((mechanism) => mechanism.predisposing),
    precipitating: mechanisms.flatMap((mechanism) => mechanism.precipitating),
    perpetuating: mechanisms.flatMap((mechanism) => mechanism.perpetuating),
    protective: mechanisms.flatMap((mechanism) => mechanism.protective),
    trigger: mechanisms.flatMap((mechanism) => mechanism.precipitating),
    meaning: mechanisms.map((mechanism) => mechanism.coreProcess),
    response: mechanisms.flatMap((mechanism) => mechanism.clinicalClues),
    repair: mechanisms.flatMap((mechanism) => mechanism.treatmentImplications),
    treatment: mechanisms.flatMap((mechanism) => mechanism.treatmentImplications),
    risk: mechanisms
      .filter((mechanism) => mechanism.domains.includes("Risk"))
      .flatMap((mechanism) => mechanism.clinicalClues),
  };

  return unique(bySection[sectionId] ?? []).slice(0, 4);
}

export function formulationDraftFor({
  mechanisms,
  templateId,
  notes,
  qualityNotes,
}: {
  mechanisms: FormulationMechanism[];
  templateId: string;
  notes: Record<string, string>;
  qualityNotes: Record<string, string>;
}) {
  const sections = formulationSectionsForTemplate(templateId);
  const lines: string[] = [`${templateId} formulation`, ""];

  const presenting = notes.presenting?.trim();
  if (presenting) lines.push("Presenting problem", presenting, "");

  lines.push("Working mechanism hypotheses");
  if (mechanisms.length) {
    lines.push(...mechanisms.map((mechanism) => `- ${mechanism.exampleSentence}`));
  } else {
    lines.push("- Select mechanisms and add case evidence before using this draft.");
  }
  lines.push("");

  for (const section of sections) {
    if (section.id === "presenting") continue;
    const note = notes[section.id]?.trim();
    const suggestions = suggestionsForFormulationSection(mechanisms, section.id);
    if (!note && !suggestions.length) continue;
    lines.push(section.label);
    lines.push(note || suggestions.map((item) => `- ${item}`).join("\n"));
    lines.push("");
  }

  lines.push("Treatment leverage");
  if (mechanisms.length) {
    lines.push(...mechanisms.map((mechanism) => `- ${mechanism.name}: ${mechanism.treatmentLeverage}`));
  } else {
    lines.push("- Link treatment targets to supported mechanism hypotheses.");
  }

  const completedQuality = formulationQualityPrompts
    .map((prompt) => ({ prompt, note: qualityNotes[prompt.id]?.trim() }))
    .filter((item) => Boolean(item.note));
  if (completedQuality.length) {
    lines.push("", "Quality review");
    for (const item of completedQuality) lines.push(`${item.prompt.label}: ${item.note}`);
  }

  lines.push("", "Draft for clinical review. Check context, alternatives, risk, culture, and disconfirming evidence.");
  return lines.join("\n");
}
