import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SheetsScreen } from "@/components/therapy-compass/screens/sheets-screen";
import { findTherapyRecord, therapySlugs } from "@/lib/therapies";

export function generateStaticParams() {
  return therapySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = findTherapyRecord(slug);
  return {
    title: record ? `${record.name} · Patient sheet - Therapy Compass` : "Therapy not found - Therapy Compass",
  };
}

export default async function TherapyCompassSheetRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!findTherapyRecord(slug)) notFound();
  return <SheetsScreen />;
}
