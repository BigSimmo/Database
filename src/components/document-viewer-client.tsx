"use client";

import dynamic from "next/dynamic";

const DocumentViewer = dynamic(() => import("@/components/DocumentViewer").then((m) => m.DocumentViewer), {
  ssr: false,
});

type DocumentViewerClientProps = {
  documentId: string;
  initialPage: number;
  chunkId?: string;
};

export function DocumentViewerClient(props: DocumentViewerClientProps) {
  return <DocumentViewer {...props} />;
}
