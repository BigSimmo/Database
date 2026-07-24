import type { Metadata } from "next";

import { MedicationRecordPage } from "@/components/clinical-dashboard/medication-record-page";
import { deriveGovernanceFromSections } from "@/lib/medication-records";
import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";

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

  // The public snapshot record is already in hand server-side. Pass it (plus the
  // governance derived exactly as the public API does) so the page paints real
  // clinical content on first load instead of a skeleton, while the client hook
  // refreshes in place for authenticated owner records. Slugs absent from the
  // snapshot (owner-only medications) pass `undefined` and keep the loading path.
  const record = getMedicationRecord(slug);
  const fallbackGovernance = record
    ? (() => {
        const derived = deriveGovernanceFromSections(record);
        // Validation/review status is a governance decision that must come from
        // the live/authoritative response, not a hard-coded guess used only for
        // the pre-fetch content-first paint.
        return { sourceStatus: derived.source_status, validationStatus: "unverified" as const };
      })()
    : undefined;

  return <MedicationRecordPage slug={slug} fallbackRecord={record} fallbackGovernance={fallbackGovernance} />;
}
