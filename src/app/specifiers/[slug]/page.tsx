import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";

type SpecifierDetailRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return specifierRecords.map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: SpecifierDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) return { title: "Specifier not found - Clinical KB" };

  return {
    title: `${record.name} - Psychiatric specifier - Clinical KB`,
    description: record.summary,
  };
}

export default async function SpecifierDetailRoute({ params }: SpecifierDetailRouteProps) {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) notFound();

  return <SpecifierRecordPage record={record} />;
}
