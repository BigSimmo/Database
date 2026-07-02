"use client";

import dynamic from "next/dynamic";

// `ssr: false` requires a Client Component in the App Router; this wrapper
// keeps the heavy dashboard bundle browser-only for the server-rendered
// home page.
export const ClinicalDashboardLazy = dynamic(
  () => import("@/components/clinical-dashboard").then((m) => m.ClinicalDashboard),
  { ssr: false },
);
