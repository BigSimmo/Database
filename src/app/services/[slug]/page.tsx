import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ServiceDetailPage } from "@/components/ServiceDetailPage";
import { getServiceRecord, serviceStaticParams } from "@/lib/services";

type ServiceRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return serviceStaticParams();
}

export async function generateMetadata({ params }: ServiceRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceRecord(slug);
  if (!service) return { title: "Service record not found - Clinical KB" };

  return {
    title: `${service.title} - Services - Clinical KB`,
    description: service.subtitle ?? "Clinical service record details and referral information.",
  };
}

export default async function ServiceRoute({ params }: ServiceRouteProps) {
  const { slug } = await params;
  const service = getServiceRecord(slug);
  if (!service) return notFound();

  return <ServiceDetailPage service={service} />;
}
