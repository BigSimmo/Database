"use client";

import dynamic from "next/dynamic";

export const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((m) => m.DocumentViewer),
  { ssr: false },
);
