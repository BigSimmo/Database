import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DifferentialDiagnosisPageClient } from "@/components/differentials/differential-diagnosis-page-client";
import { differentialStaticParams, getDifferentialDetailContext } from "@/lib/differentials";
import { readDifferentialPageRecord } from "@/lib/site-content/differential-page-records";

type DifferentialDiagnosisRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return differentialStaticParams();
}

export async function generateMetadata({ params }: DifferentialDiagnosisRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const record = await readDifferentialPageRecord(slug);
  if (!record) return { title: "Differential diagnosis not found - PsychSift" };

  return {
    title: `${record.title} - Differential diagnosis - PsychSift`,
    description: record.subtitle,
  };
}

export default async function DifferentialDiagnosisRoute({ params }: DifferentialDiagnosisRouteProps) {
  const { slug } = await params;
  const record = await readDifferentialPageRecord(slug);
  if (!record) notFound();

  return (
    <DifferentialDiagnosisPageClient
      slug={slug}
      fallbackRecord={record}
      detailContext={getDifferentialDetailContext(record)}
    />
  );
}
