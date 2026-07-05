import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MedicationRecordPage } from "@/components/clinical-dashboard/medication-record-page";
import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medications";

type MedicationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return loadMedicationSnapshot().map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: MedicationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = getMedicationRecord(slug);
  if (!record) {
    return {
      title: "Medication | Clinical KB",
    };
  }

  return {
    title: `${record.name} | Clinical KB`,
    description: `${record.name} prescribing summary, dosing, safety checks, monitoring, access, and provenance.`,
  };
}

export default async function MedicationPage({ params }: MedicationPageProps) {
  const { slug } = await params;
  if (!getMedicationRecord(slug)) notFound();

  return <MedicationRecordPage slug={slug} />;
}
