import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DifferentialDiagnosisPageClient } from "@/components/differentials/differential-diagnosis-page-client";
import { differentialStaticParams, getDifferentialDetailContext, getDifferentialRecord } from "@/lib/differentials";
import { MedicalJsonLd } from "@/components/seo/MedicalJsonLd";

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
    alternates: {
      canonical: `/differentials/diagnoses/${slug}`,
    },
  };
}

export default async function DifferentialDiagnosisRoute({ params }: DifferentialDiagnosisRouteProps) {
  const { slug } = await params;
  const record = getDifferentialRecord(slug);
  if (!record) notFound();

  return (
    <>
      <MedicalJsonLd
        type="MedicalCondition"
        name={record.title}
        description={record.subtitle}
        url={`/differentials/diagnoses/${slug}`}
      />
      <DifferentialDiagnosisPageClient
        slug={slug}
        fallbackRecord={record}
        detailContext={getDifferentialDetailContext(record)}
      />
    </>
  );
}
