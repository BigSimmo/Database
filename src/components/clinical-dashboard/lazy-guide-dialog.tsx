"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

export const loadGuideDialog = () =>
  import("@/components/clinical-dashboard/guide-dialog").then((module) => module.GuideDialog);

export const GuideDialog = dynamic(loadGuideDialog, { ssr: false });

export function LazyGuideDialog(props: ComponentProps<typeof GuideDialog>) {
  return props.open ? <GuideDialog {...props} /> : null;
}
