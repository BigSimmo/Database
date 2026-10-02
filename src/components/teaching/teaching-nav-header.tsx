"use client";

import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";

/* The document-viewer header for the session page and the code screen, the two routes U2 claimed. */
export function TeachingNavHeader({
  title,
  testIdPrefix,
  back,
  actions,
  titleAs,
}: {
  title: string;
  /** `"h1"` when the header's title is the page's only heading (the code screen). */
  titleAs?: "span" | "h1";
  testIdPrefix: string;
  back: { href: string; label: string };
  actions?: ReactNode;
}) {
  if (!actions) return <InPageNavHeader back={back} title={title} titleAs={titleAs} testIdPrefix={testIdPrefix} />;
  return (
    <InPageNavHeader
      back={back}
      title={title}
      titleAs={titleAs}
      testIdPrefix={testIdPrefix}
      actions={actions}
      actionsTitle="This session"
      actionsDescription="For the presenter and your service's organisers."
      actionsNoun="session"
    />
  );
}
