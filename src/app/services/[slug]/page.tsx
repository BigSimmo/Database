import type { Metadata } from "next";

import { ServiceDetailClient } from "@/components/services/service-detail-client";
import { getServiceRecord } from "@/lib/services";

type ServiceRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ServiceRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceRecord(slug);

  return {
    title: service ? `${service.title} - Services - Clinical KB` : "Service record - Services - Clinical KB",
    description: service?.subtitle ?? "Clinical service record details and referral information.",
  };
}

export default async function ServiceRoute({ params }: ServiceRouteProps) {
  const { slug } = await params;
  return <ServiceDetailClient slug={slug} />;
}
