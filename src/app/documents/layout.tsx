import type { ReactNode } from "react";

import { DocumentsLayoutClient } from "@/app/documents/documents-layout-client";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return <DocumentsLayoutClient>{children}</DocumentsLayoutClient>;
}
