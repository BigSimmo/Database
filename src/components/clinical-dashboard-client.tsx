"use client";

import dynamic from "next/dynamic";
import type { AppModeId } from "@/lib/app-modes";

const ClinicalDashboard = dynamic(() => import("@/components/clinical-dashboard").then((m) => m.ClinicalDashboard), {
  ssr: false,
});

type ClinicalDashboardClientProps = {
  initialSearchMode?: AppModeId;
  initialQuery?: string;
  focusSearch?: boolean;
  autoRunSearch?: boolean;
};

export function ClinicalDashboardClient(props: ClinicalDashboardClientProps) {
  return <ClinicalDashboard {...props} />;
}
