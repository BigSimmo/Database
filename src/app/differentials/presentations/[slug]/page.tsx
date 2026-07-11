import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DifferentialPresentationWorkflowPage } from "@/components/differentials/differential-presentation-workflow-page";
import { getPresentationWorkflow, presentationStaticParams } from "@/lib/differentials";

type DifferentialPresentationRouteProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; ids?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function generateStaticParams() {
  return presentationStaticParams();
}

export async function generateMetadata({ params }: DifferentialPresentationRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const workflow = getPresentationWorkflow(slug);
  if (!workflow) return { title: "Differential presentation not found - Clinical KB" };
  return {
    title: `${workflow.title} - Differential presentation - Clinical KB`,
    description: workflow.subtitle,
  };
}

export default async function DifferentialPresentationRoute({
  params,
  searchParams,
}: DifferentialPresentationRouteProps) {
  const { slug } = await params;
  if (!getPresentationWorkflow(slug)) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = firstSearchParam(resolvedSearchParams.query ?? resolvedSearchParams.q)?.trim() ?? "";
  const selectedIds = (firstSearchParam(resolvedSearchParams.ids) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return <DifferentialPresentationWorkflowPage query={query} presentationSlug={slug} selectedIds={selectedIds} />;
}
