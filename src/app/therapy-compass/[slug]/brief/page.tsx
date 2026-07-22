import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BriefScreen } from "@/components/therapy-compass/screens/brief-screen";
import { findTherapyRecord, therapyBriefSlugs } from "@/lib/therapies";

export function generateStaticParams() {
  // Only records that actually ship a brief-intervention version get a route.
  return therapyBriefSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = findTherapyRecord(slug);
  return {
    title:
      record && record.briefInterventionAvailable
        ? `${record.name} · Brief intervention - Therapy mode`
        : "Therapy not found - Therapy mode",
  };
}

export default async function TherapyCompassBriefRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = findTherapyRecord(slug);
  // 404 unknown records and records without a brief-intervention version, rather
  // than rendering an unsupported workflow.
  if (!record || !record.briefInterventionAvailable) notFound();
  return <BriefScreen />;
}
