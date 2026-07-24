import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { SpecifierReferencePage } from "@/components/specifiers/specifier-reference-page";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";
import { getSpecifierCatalogItem, popularCatalogSlugs } from "@/lib/specifiers-content";

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

  const record = findSpecifier(slug);
  if (record) {
    return {
      title: `${record.name} - Psychiatric specifier - Clinical KB`,
      description: record.summary,
    };
  }

  const item = getSpecifierCatalogItem(slug);
  if (item) {
    return {
      title: `${item.label} - ${item.disorderName} specifier - Clinical KB`,
      description: `${item.label} — ${item.disorderName} specifier (${item.categoryName}).`,
    };
  }

  return { title: "Specifier not found - Clinical KB" };
}

export default async function SpecifierDetailRoute({ params }: SpecifierDetailRouteProps) {
  const { slug } = await params;

  const record = findSpecifier(slug);
  if (record) return <SpecifierRecordPage record={record} />;

  const item = getSpecifierCatalogItem(slug);
  if (item) return <SpecifierReferencePage item={item} />;

  notFound();
}
