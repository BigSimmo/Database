import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DifferentialDetailPage } from "@/components/differentials/differential-detail-page";
import { differentialStaticParams, getDifferentialRecord } from "@/lib/differentials";

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

  return <DifferentialDetailPage record={record} />;
}
