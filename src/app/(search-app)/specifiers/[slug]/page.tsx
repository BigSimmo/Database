import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { SpecifierReferencePage } from "@/components/specifiers/specifier-reference-page";
import { specifierRecords } from "@/lib/specifiers";
import { popularCatalogSlugs, publicSpecifierRecordBySlug } from "@/lib/specifiers-content";

// Curated records are always pre-rendered. The full DSM-5-TR catalogue (~585 items)
// is too large to statically generate in full, so only the source-verified subset is
// pre-rendered and the remainder render on demand.
export const dynamicParams = true;

type SpecifierDetailRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  const curated = specifierRecords.map((record) => record.slug);
  const catalog = popularCatalogSlugs();
  return Array.from(new Set([...curated, ...catalog])).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SpecifierDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;

  const resolved = publicSpecifierRecordBySlug(slug);
  if (resolved?.source === "curated") {
    return {
      title: `${resolved.record.name} - Psychiatric specifier - PsychSift`,
      description: resolved.record.summary,
    };
  }

  if (resolved?.source === "catalogue") {
    return {
      title: `${resolved.item.label} - ${resolved.item.disorderName} specifier - PsychSift`,
      description: `${resolved.item.label} — ${resolved.item.disorderName} specifier (${resolved.item.categoryName}).`,
    };
  }

  return { title: "Specifier not found - PsychSift" };
}

export default async function SpecifierDetailRoute({ params }: SpecifierDetailRouteProps) {
  const { slug } = await params;

  const resolved = publicSpecifierRecordBySlug(slug);
  if (resolved?.source === "curated") return <SpecifierRecordPage record={resolved.record} />;

  if (resolved?.source === "catalogue") return <SpecifierReferencePage item={resolved.item} />;

  notFound();
}
