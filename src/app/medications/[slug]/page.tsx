import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AcamprosateMedicationPage } from "@/components/clinical-dashboard/medication-prescribing-workspace";

type MedicationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return [{ slug: "acamprosate" }];
}

export async function generateMetadata({ params }: MedicationPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== "acamprosate") {
    return {
      title: "Medication | Clinical KB",
    };
  }

  return {
    title: "Acamprosate | Clinical KB",
    description: "Acamprosate prescribing summary, dosing, safety checks, monitoring, access, and provenance.",
  };
}

export default async function MedicationPage({ params }: MedicationPageProps) {
  const { slug } = await params;
  if (slug !== "acamprosate") notFound();

  return <AcamprosateMedicationPage />;
}
