import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DsmDiagnosisPage } from "@/components/dsm/dsm-diagnosis-page";
import { dsmStaticParams, getDsmDiagnosis } from "@/lib/dsm";

type DsmDiagnosisRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return dsmStaticParams();
}

export async function generateMetadata({ params }: DsmDiagnosisRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const diagnosis = getDsmDiagnosis(slug);
  if (!diagnosis) return { title: "DSM diagnosis not found | Clinical KB" };

  return {
    title: `${diagnosis.title} | DSM-5 Diagnosis | Clinical KB`,
    description: `${diagnosis.title} criteria, specifiers, differential considerations, and documentation support.`,
  };
}

export default async function DsmDiagnosisRoute({ params }: DsmDiagnosisRouteProps) {
  const { slug } = await params;
  const diagnosis = getDsmDiagnosis(slug);
  if (!diagnosis) notFound();

  return <DsmDiagnosisPage diagnosis={diagnosis} />;
}
