import type { Metadata } from "next";

import { ServiceDetailClient } from "@/components/services/service-detail-client";

type ServiceRouteProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Service record - Services - Clinical KB",
  description: "Clinical service record details and referral information.",
};

export default async function ServiceRoute({ params }: ServiceRouteProps) {
  const { slug } = await params;
  return <ServiceDetailClient slug={slug} />;
}
