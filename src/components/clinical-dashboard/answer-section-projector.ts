import { primaryAnswerDisplayText } from "@/components/clinical-dashboard/answer-content";
import { sanitizeDisplayText } from "@/components/clinical-dashboard/display-text";
import type { ClientRagAnswerPayload, ClientSearchResult } from "@/lib/answer-client-payload";
import { ragAdaptiveAnswerPromptVersion } from "@/lib/rag/rag-versioning";
import type { AnswerSection } from "@/lib/types";

export type ProjectedAnswerSection = AnswerSection & { citationSources: ClientSearchResult[] };

export type ProjectedAnswerForMainSurface = {
  leadText: string;
  leadCitationSources: ClientSearchResult[];
  sections: ProjectedAnswerSection[];
};

function citedSourcesInOrder(ids: readonly string[], sources: readonly ClientSearchResult[]) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const cited: ClientSearchResult[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const source = sourceById.get(id);
    if (!source) continue;
    seen.add(id);
    cited.push(source);
  }
  return cited;
}

/** Lossless browser projection of the authoritative final answer. */
export function projectAnswerForMainSurface({
  answer,
  sources,
  preformatted,
}: {
  answer: ClientRagAnswerPayload;
  sources: ClientSearchResult[];
  preformatted: boolean;
}): ProjectedAnswerForMainSurface {
  return {
    leadText: primaryAnswerDisplayText(answer.answer, { preformatted, preserveBold: true }),
    leadCitationSources: citedSourcesInOrder(
      answer.citations.map((citation) => citation.chunk_id),
      sources,
    ),
    sections: (answer.answerSections ?? []).map((section) => ({
      ...section,
      heading: sanitizeDisplayText(section.heading, { minLength: 1, minTokens: 1 }),
      body: primaryAnswerDisplayText(section.body, { preformatted, preserveBold: true }),
      citationSources: citedSourcesInOrder(section.citation_chunk_ids, sources),
    })),
  };
}

/** Presentation permission is final-payload authority plus the literal v20 contract. */
export function answerUsesAdaptiveMainSurface(answer: ClientRagAnswerPayload) {
  return answer.answerContractVersion === ragAdaptiveAnswerPromptVersion && answer.renderAdaptiveAnswer === true;
}
