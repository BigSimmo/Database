"use client";

import { RegistryRecordLoader } from "@/components/registry-record-loader";
import { FormDetailPage } from "@/components/forms/form-detail-page";

export function FormDetailClient({ slug }: { slug: string }) {
  return (
    <RegistryRecordLoader kind="form" slug={slug}>
      {(record) => <FormDetailPage form={record} />}
    </RegistryRecordLoader>
  );
}
