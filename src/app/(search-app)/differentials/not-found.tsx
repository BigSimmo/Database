"use client";

import { RouteNotFoundPanel } from "@/components/route-not-found-panel";
import { appModeHomeHref } from "@/lib/app-modes";

export default function NotFound() {
  return (
    <RouteNotFoundPanel
      title="Differential Not Found"
      description="The requested differential diagnosis could not be found or has been deleted."
      returnHref={appModeHomeHref("differentials")}
      returnLabel="Return to differentials"
    />
  );
}
