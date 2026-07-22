import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SheetsScreen } from "@/components/therapy-compass/screens/sheets-screen";
import { findTherapyRecord, therapySheetSlugs } from "@/lib/therapies";

export function generateStaticParams() {
  // Only records that actually ship a patient sheet get a route.
  return therapySheetSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = findTherapyRecord(slug);
  return {
    title:
      record && record.patientSheetAvailable
        ? `${record.name} · Patient sheet - Therapy mode`
        : "Therapy not found - Therapy mode",
  };
}

export default async function TherapyCompassSheetRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = findTherapyRecord(slug);
  // 404 unknown records and records without a patient sheet, rather than
  // rendering an unsupported workflow.
  if (!record || !record.patientSheetAvailable) notFound();
  return <SheetsScreen />;
}
