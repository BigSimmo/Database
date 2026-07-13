import { notFound } from "next/navigation";

import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";

export function generateStaticParams() {
  return specifierRecords.map((record) => ({ slug: record.slug }));
}

export default async function SpecifierDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) notFound();

  return <SpecifierRecordPage record={record} />;
}
