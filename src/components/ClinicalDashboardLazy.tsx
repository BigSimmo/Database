"use client";

import dynamic from "next/dynamic";

export const ClinicalDashboard = dynamic(
  () => import("@/components/clinical-dashboard").then((m) => m.ClinicalDashboard),
  { ssr: false },
);
