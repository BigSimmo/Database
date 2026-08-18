"use client";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";

export function TherapyRecordNavHeader({
  title,
  backHref,
  backLabel,
  testIdPrefix,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  testIdPrefix: string;
}) {
  return (
    <InPageNavHeader
      back={{ href: backHref, label: backLabel }}
      title={title}
      actionsNoun="therapy"
      testIdPrefix={testIdPrefix}
    />
  );
}
