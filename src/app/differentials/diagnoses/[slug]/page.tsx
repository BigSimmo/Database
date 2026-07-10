import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DifferentialDiagnosisPageClient } from "@/components/differentials/differential-diagnosis-page-client";
import { differentialStaticParams, getDifferentialDetailContext, getDifferentialRecord } from "@/lib/differentials";

type DifferentialDiagnosisRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return differentialStaticParams();
}

export async function generateMetadata({ params }: DifferentialDiagnosisRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const record = getDifferentialRecord(slug);
  if (!record) return { title: "Differential diagnosis not found - Clinical KB" };

  return {
    title: `${record.title} - Differential diagnosis - Clinical KB`,
    description: record.subtitle,
  };
}

export default async function DifferentialDiagnosisRoute({ params }: DifferentialDiagnosisRouteProps) {
  const { slug } = await params;
  const record = getDifferentialRecord(slug);
  if (!record) notFound();

  return (
    <DifferentialDiagnosisPageClient
      slug={slug}
      fallbackRecord={record}
      detailContext={getDifferentialDetailContext(record)}
    />
  );
}
