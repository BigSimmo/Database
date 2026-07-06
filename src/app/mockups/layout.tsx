import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { mockupsEnabled } from "@/lib/env";

import { MockupsLayoutClient } from "./mockups-layout-client";

// Design-exploration prototypes: shipped for shareability, but never indexed
// (belt-and-braces alongside the robots.ts /mockups/ disallow).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MockupsLayout({ children }: { children: ReactNode }) {
  if (!mockupsEnabled()) {
    notFound();
  }
  return <MockupsLayoutClient>{children}</MockupsLayoutClient>;
}
