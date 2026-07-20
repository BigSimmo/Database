import type { RegistryCorpusKind } from "./registry-corpus";

export function registryCorpusDetailHref(args: {
  kind: RegistryCorpusKind | string | null | undefined;
  slug: string | null | undefined;
  subkind?: string | null | undefined;
  recordId?: string | null | undefined;
}) {
  const kind = typeof args.kind === "string" ? args.kind : null;
  const slug = typeof args.slug === "string" ? args.slug : null;
  const subkind = typeof args.subkind === "string" ? args.subkind : null;
  if (!kind || !slug) return null;
  if (kind === "service") return `/services/${slug}`;
  if (kind === "form") return `/forms/${slug}`;
  if (kind === "medication") return `/medications/${slug}`;
  if (kind === "differential") {
    return subkind === "presentation" ? `/differentials/presentations/${slug}` : `/differentials/diagnoses/${slug}`;
  }
  return null;
}
