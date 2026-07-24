import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  DsmDifferentialConsiderationsPage,
  type DsmDifferentialConsideration,
} from "@/components/dsm/dsm-differential-considerations-page";
import { dsmCriteria, dsmStaticParams, getDsmDiagnosis, resolveDsmDifferential } from "@/lib/dsm";

type DsmDifferentialRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return dsmStaticParams();
}

function considerationGroup(value: string): DsmDifferentialConsideration["group"] {
  const normalized = value.toLowerCase();
  if (/substance|medication|medical|thyroid|neurolog|cns|seizure|sleep|hormone/.test(normalized)) {
    return "substance-medical";
  }
  if (/episode|history|chronic|episod|duration|full criteria|subthreshold|persistent|onset/.test(normalized)) {
    return "course";
  }
  if (/grief|bereavement|adjustment|personality|adhd|development|cultural|context/.test(normalized)) {
    return "context";
  }
  return "overlap";
}

function buildConsiderations(values: string[]): DsmDifferentialConsideration[] {
  return values.map((value, index) => {
    const rationaleMatch = value.match(/\(([^()]*)\)\s*$/);
    const title = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const match = resolveDsmDifferential(value);
    return {
      id: `${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      fullText: value,
      rationale:
        rationaleMatch?.[1]?.trim() || "Listed as a differential consideration in the supplied diagnosis record.",
      group: considerationGroup(value),
      matchedDiagnosis: match
        ? {
            slug: match.slug,
            title: match.title,
            icdCode: match.icd_code,
            category: match.category.label,
            coreFeatures: dsmCriteria(match)
              .slice(0, 4)
              .map((criterion) => `${criterion.label}. ${criterion.text}`),
          }
        : undefined,
    };
  });
}

export async function generateMetadata({ params }: DsmDifferentialRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const diagnosis = getDsmDiagnosis(slug);
  if (!diagnosis) return { title: "DSM differential considerations | Clinical KB" };
  return {
    title: `${diagnosis.title} differential considerations | Clinical KB`,
    description: `Structured differential considerations for ${diagnosis.title}.`,
  };
}

export default async function DsmDifferentialRoute({ params }: DsmDifferentialRouteProps) {
  const { slug } = await params;
  const diagnosis = getDsmDiagnosis(slug);
  if (!diagnosis) notFound();

  return (
    <DsmDifferentialConsiderationsPage
      diagnosis={{
        slug: diagnosis.slug,
        title: diagnosis.title,
        icdCode: diagnosis.icd_code,
        category: diagnosis.category.label,
      }}
      considerations={buildConsiderations(diagnosis.differentials)}
    />
  );
}
