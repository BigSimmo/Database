"use client";

import { RegistryRecordLoader } from "@/components/registry-record-loader";
import { FormDetailPage } from "@/components/forms/form-detail-page";
import type { ServiceRecord } from "@/lib/services";

export function FormDetailClient({ slug, fallbackRecord }: { slug: string; fallbackRecord?: ServiceRecord | null }) {
  return (
    <RegistryRecordLoader kind="form" slug={slug} fallbackRecord={fallbackRecord}>
      {(record) => <FormDetailPage form={record} />}
    </RegistryRecordLoader>
  );
}
