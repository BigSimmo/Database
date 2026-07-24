import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailScreen } from "@/components/therapy-compass/screens/detail-screen";
import { findTherapyRecord, therapyNeedsReview, therapySlugs } from "@/lib/therapies";

export function generateStaticParams() {
  return therapySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = findTherapyRecord(slug);
  if (!record) return { title: "Therapy not found - Therapy mode" };
  const summary = record.clinicalSummary ?? record.bestUsedFor ?? "Source-grounded therapy record.";
  return {
    title: `${record.name} - Therapy mode`,
    description: therapyNeedsReview(record) ? `${summary} (Awaiting source review.)` : summary,
  };
}

export default async function TherapyCompassDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!findTherapyRecord(slug)) notFound();
  return <DetailScreen />;
}
