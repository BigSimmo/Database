<<<<<<< HEAD
import type { Metadata } from "next";
import { notFound } from "next/navigation";
=======
import { notFound } from "next/navigation";
import type { Metadata } from "next";
>>>>>>> origin/main

import { SpecifierRecordPage } from "@/components/specifiers/specifier-record-page";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";

<<<<<<< HEAD
type SpecifierDetailRouteProps = {
  params: Promise<{ slug: string }>;
};

=======
>>>>>>> origin/main
export function generateStaticParams() {
  return specifierRecords.map((record) => ({ slug: record.slug }));
}

<<<<<<< HEAD
export async function generateMetadata({ params }: SpecifierDetailRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) return { title: "Specifier not found - Clinical KB" };

  return {
    title: `${record.name} - Psychiatric specifier - Clinical KB`,
=======
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) return {};

  return {
    title: record.name,
>>>>>>> origin/main
    description: record.summary,
  };
}

<<<<<<< HEAD
export default async function SpecifierDetailRoute({ params }: SpecifierDetailRouteProps) {
=======
export default async function SpecifierDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
>>>>>>> origin/main
  const { slug } = await params;
  const record = findSpecifier(slug);
  if (!record) notFound();

  return <SpecifierRecordPage record={record} />;
}
