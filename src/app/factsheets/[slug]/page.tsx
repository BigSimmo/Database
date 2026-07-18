import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FactsheetDetailPage } from "@/components/factsheets/factsheet-detail-page";
import { factsheetSlugs, findFactsheet } from "@/components/factsheets/factsheets-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return factsheetSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const factsheet = findFactsheet(slug);
  return { title: factsheet ? `${factsheet.title} | Patient Information` : "Factsheet not found" };
}

export default async function FactsheetInfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const factsheet = findFactsheet(slug);
  if (!factsheet) notFound();
  return <FactsheetDetailPage factsheet={factsheet} />;
}
