import presentationDisplayCatalog from "@/data/differential-presentation-display-metadata.json";
import type { DifferentialPresentationWorkflow } from "@/lib/differential-snapshot";

type PresentationDisplayMetadata = {
  title: string;
  scopeLabel: string;
  aliases: string[];
};

const presentationDisplayMetadata = presentationDisplayCatalog.presentations as Record<
  string,
  PresentationDisplayMetadata
>;

function distinctTerms(values: Array<string | undefined>) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return [];
    const key = trimmed.toLocaleLowerCase("en-AU");
    if (seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

/**
 * Applies researched display terminology without changing the stable workflow
 * slug or discarding the imported title. This runs for both local fixtures and
 * owner-scoped catalogue payloads, so older seeded rows gain the same labels
 * without requiring a hosted data mutation.
 */
export function normalizePresentationWorkflow(
  workflow: DifferentialPresentationWorkflow,
): DifferentialPresentationWorkflow {
  const metadata = presentationDisplayMetadata[workflow.id];
  if (!metadata) return workflow;

  const sourceTitle = workflow.sourceTitle?.trim() || workflow.title.trim();
  return {
    ...workflow,
    title: metadata.title,
    sourceTitle,
    scopeLabel: metadata.scopeLabel,
    titleAliases: distinctTerms([sourceTitle, ...metadata.aliases, ...(workflow.titleAliases ?? [])]),
  };
}

export function presentationDisplayMetadataForSlug(slug: string) {
  return presentationDisplayMetadata[slug] ?? null;
}
