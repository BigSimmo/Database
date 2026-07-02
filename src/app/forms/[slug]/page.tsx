import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormDetailPage } from "@/components/forms/form-detail-page";
import { getFormRecord, formStaticParams } from "@/lib/forms";

type FormRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return formStaticParams();
}

export async function generateMetadata({ params }: FormRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const form = getFormRecord(slug);
  if (!form) return { title: "Form not found - Clinical KB" };

  return {
    title: `${form.title} - Forms - Clinical KB`,
    description: form.subtitle ?? "Psychiatry form and workflow details.",
  };
}

export default async function FormRoute({ params }: FormRouteProps) {
  const { slug } = await params;
  const form = getFormRecord(slug);
  if (!form) return notFound();

  return <FormDetailPage form={form} />;
}
