"use client";

import dynamic from "next/dynamic";

// `ssr: false` requires a Client Component in the App Router; this wrapper
// keeps the viewer bundle browser-only for the server-rendered document page.
export const DocumentViewerLazy = dynamic(
  () => import("@/components/DocumentViewer").then((m) => m.DocumentViewer),
  { ssr: false },
);
