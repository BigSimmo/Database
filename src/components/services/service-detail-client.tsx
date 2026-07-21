"use client";

import { RegistryRecordLoader } from "@/components/registry-record-loader";
import { ServiceDetailPage } from "@/components/services/service-detail-page";
import type { ServiceRecord } from "@/lib/services";

export function ServiceDetailClient({ slug, fallbackRecord }: { slug: string; fallbackRecord?: ServiceRecord | null }) {
  return (
    <RegistryRecordLoader kind="service" slug={slug} fallbackRecord={fallbackRecord}>
      {(record) => <ServiceDetailPage service={record} />}
    </RegistryRecordLoader>
  );
}
