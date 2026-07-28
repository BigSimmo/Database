"use client";

import dynamic from "next/dynamic";
import { DocumentViewerPageSkeleton } from "@/components/mode-home-page-skeleton";

export const DocumentViewerLazy = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  {
    ssr: false,
    loading: () => <DocumentViewerPageSkeleton />,
  }
);
