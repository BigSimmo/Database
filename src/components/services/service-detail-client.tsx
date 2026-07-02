"use client";

import { RegistryRecordLoader } from "@/components/registry-record-loader";
import { ServiceDetailPage } from "@/components/services/service-detail-page";

export function ServiceDetailClient({ slug }: { slug: string }) {
  return (
    <RegistryRecordLoader kind="service" slug={slug}>
      {(record) => <ServiceDetailPage service={record} />}
    </RegistryRecordLoader>
  );
}
