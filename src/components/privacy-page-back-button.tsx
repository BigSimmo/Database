"use client";

import { useSearchParams } from "next/navigation";

import { NavigationBackButton } from "@/components/navigation-back-button";
import { appModeHomeHref, isAppModeId } from "@/lib/app-modes";

export function PrivacyPageBackButton() {
  const searchParams = useSearchParams();
  const returnMode = searchParams.get("from");
  const fallbackHref = isAppModeId(returnMode) ? appModeHomeHref(returnMode) : "/";

  return <NavigationBackButton fallbackHref={fallbackHref} />;
}
