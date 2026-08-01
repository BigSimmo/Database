"use client";

import { RouteNotFoundPanel } from "@/components/route-not-found-panel";
import { appModeHomeHref } from "@/lib/app-modes";

export default function NotFound() {
  return (
    <RouteNotFoundPanel
      title="Document Not Found"
      description="This document is unavailable. It may be private (sign in from the header if you have access), missing, or removed."
      returnHref={appModeHomeHref("documents")}
      returnLabel="Return to document library"
    />
  );
}
