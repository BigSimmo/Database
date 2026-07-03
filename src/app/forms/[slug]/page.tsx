import type { Metadata } from "next";

import { FormDetailClient } from "@/components/forms/form-detail-client";

type FormRouteProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Form record - Forms - Clinical KB",
  description: "Psychiatry form and workflow details.",
};

export default async function FormRoute({ params }: FormRouteProps) {
  const { slug } = await params;
  return <FormDetailClient slug={slug} />;
}
