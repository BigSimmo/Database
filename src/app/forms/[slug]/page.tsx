import type { Metadata } from "next";

import { FormDetailClient } from "@/components/forms/form-detail-client";
import { getFormRecord } from "@/lib/forms";

type FormRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: FormRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const form = getFormRecord(slug);

  return {
    title: form ? `${form.title} - Forms - Clinical KB` : "Form record - Forms - Clinical KB",
    description: form?.subtitle ?? "Psychiatry form and workflow details.",
  };
}

export default async function FormRoute({ params }: FormRouteProps) {
  const { slug } = await params;
  // Hand the public fixture record to the client so the detail view paints real
  // content on first load instead of a centered spinner; the owner-aware record
  // refreshes in place. Absent from the fixtures (owner-only slug) → null.
  const fallbackRecord = getFormRecord(slug);
  return <FormDetailClient slug={slug} fallbackRecord={fallbackRecord} />;
}
