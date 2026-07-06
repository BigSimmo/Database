import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { mockupsEnabled } from "@/lib/env";

import { MockupsLayoutClient } from "./mockups-layout-client";

export default function MockupsLayout({ children }: { children: ReactNode }) {
  if (!mockupsEnabled()) {
    notFound();
  }
  return <MockupsLayoutClient>{children}</MockupsLayoutClient>;
}
