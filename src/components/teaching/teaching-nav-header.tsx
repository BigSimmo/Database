"use client";

import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";

/* The document-viewer header for the session page and the code screen, the two routes U2 claimed. */
export function TeachingNavHeader({
  title,
  testIdPrefix,
  back,
  actions,
}: {
  title: string;
  testIdPrefix: string;
  back: { href: string; label: string };
  actions?: ReactNode;
}) {
  if (!actions) return <InPageNavHeader back={back} title={title} testIdPrefix={testIdPrefix} />;
  return (
    <InPageNavHeader
      back={back}
      title={title}
      testIdPrefix={testIdPrefix}
      actions={actions}
      actionsTitle="This session"
      actionsDescription="For the presenter and your service's organisers."
      actionsNoun="session"
    />
  );
}
