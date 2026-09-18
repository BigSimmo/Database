/**
 * The mechanism ranking, draft and suggestion algorithms, with no content
 * attached.
 *
 * There are two mechanism record sets: the full ones in `formulation.ts`, which
 * carry evidence locators, caveats and review metadata and stay on the server,
 * and the trimmed client index in `formulation-mechanism-index.ts`. Both are
 * ranked, drafted from and suggested from identically, so the algorithms live
 * here once and each side binds its own records to them. Duplicating them would
 * let the browser's result order drift from the server's — the weights below are
 * pinned by `tests/formulation.test.ts`.
 *
 * Every function is generic over the smallest field set it actually reads, so a
 * record that carries more (the full one) is accepted wherever a record that
 * carries less would be.
 */

export function normalizeFormulationText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function uniqueFormulationValues(values: string[]) {
  return Array.from(new Set(values));
}

/** What the search haystack is built from. */
export type FormulationMechanismSearchFields = {
  id: string;
  name: string;
  definition: string;
  summary: string;
  coreProcess: string;
  formulationUse: string;
  symptoms: string[];
  diagnosticContexts: string[];
  domains: string[];
  tags: string[];
  clinicalClues: string[];
  patientPhrases: string[];
  fitIndicators: string[];
};

function searchText(mechanism: FormulationMechanismSearchFields) {
  return normalizeFormulationText(
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

export type FormulationMechanismRankOptions = {
  domain?: string;
  domains?: ReadonlySet<string>;
  expansions?: readonly string[];
};

export function rankFormulationMechanisms<T extends FormulationMechanismSearchFields>(
  mechanisms: readonly T[],
  normalizedQuery: string,
  options: FormulationMechanismRankOptions = {},
): Array<{ mechanism: T; score: number }> {
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const expansionTokens = Array.from(
    new Set(
      (options.expansions ?? []).flatMap((expansion) => normalizeFormulationText(expansion).split(" ").filter(Boolean)),
    ),
  );
  const domainFacets = options.domains;

  return mechanisms
    .map((mechanism, index) => {
      if (options.domain && options.domain !== "all" && !mechanism.domains.includes(options.domain)) return null;
      if (domainFacets?.size && !mechanism.domains.some((domain) => domainFacets.has(domain))) return null;

      const haystack = searchText(mechanism);
      const name = normalizeFormulationText(mechanism.name);
      const phrases = normalizeFormulationText(mechanism.patientPhrases.join(" "));
      const clues = normalizeFormulationText(mechanism.clinicalClues.join(" "));
      const tags = normalizeFormulationText(mechanism.tags.join(" "));
      let score = normalizedQuery ? 0 : mechanisms.length - index;

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
        for (const token of expansionTokens) {
          if (name.includes(token)) score += 5;
          if (phrases.includes(token)) score += 4;
          if (clues.includes(token)) score += 3;
          if (haystack.includes(token)) score += 1;
        }
      }

      return score > 0 ? { mechanism, score } : null;
    })
    .filter((result): result is { mechanism: T; score: number } => Boolean(result))
    .sort((left, right) => right.score - left.score || left.mechanism.name.localeCompare(right.mechanism.name));
}

/** What a builder section suggestion is drawn from. */
export type FormulationMechanismSuggestionFields = {
  symptoms: string[];
  predisposing: string[];
  precipitating: string[];
  perpetuating: string[];
  protective: string[];
  coreProcess: string;
  clinicalClues: string[];
  treatmentImplications: string[];
  domains: string[];
};

export function formulationSectionSuggestions(
  mechanisms: readonly FormulationMechanismSuggestionFields[],
  sectionId: string,
) {
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

  return uniqueFormulationValues(bySection[sectionId] ?? []).slice(0, 4);
}

/** What the exported draft names each selected mechanism by. */
export type FormulationMechanismDraftFields = {
  name: string;
  exampleSentence: string;
  treatmentLeverage: string;
};

export function buildFormulationDraft({
  mechanisms,
  sections,
  qualityPrompts,
  templateId,
  notes,
  qualityNotes,
}: {
  mechanisms: readonly FormulationMechanismDraftFields[];
  sections: ReadonlyArray<{ id: string; label: string }>;
  qualityPrompts: ReadonlyArray<{ id: string; label: string }>;
  templateId: string;
  notes: Record<string, string>;
  qualityNotes: Record<string, string>;
}) {
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

  // A section the clinician left blank used to be filled with the library's own
  // prompts for the selected mechanisms, unlabelled and indistinguishable from
  // elicited history once the draft was copied into a record. Missing case
  // evidence has to stay missing: the prompts are still one click away behind
  // "Use suggestions", which is an explicit clinician action.
  for (const section of sections) {
    if (section.id === "presenting") continue;
    const note = notes[section.id]?.trim();
    lines.push(section.label);
    lines.push(note || "- No case evidence recorded.");
    lines.push("");
  }

  lines.push("Treatment leverage");
  if (mechanisms.length) {
    lines.push(...mechanisms.map((mechanism) => `- ${mechanism.name}: ${mechanism.treatmentLeverage}`));
  } else {
    lines.push("- Link treatment targets to supported mechanism hypotheses.");
  }

  const completedQuality = qualityPrompts
    .map((prompt) => ({ prompt, note: qualityNotes[prompt.id]?.trim() }))
    .filter((item) => Boolean(item.note));
  if (completedQuality.length) {
    lines.push("", "Quality review");
    for (const item of completedQuality) lines.push(`${item.prompt.label}: ${item.note}`);
  }

  lines.push("", "Draft for clinical review. Check context, alternatives, risk, culture, and disconfirming evidence.");
  return lines.join("\n");
}
