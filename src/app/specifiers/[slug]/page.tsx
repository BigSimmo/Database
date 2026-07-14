import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";

export function generateStaticParams() {
  return specifierRecords.map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) return {};

  return {
    title: record.name,
    description: record.summary,
  };
}

export default async function SpecifierDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) notFound();

  return <SpecifierRecordPage record={record} />;
}
