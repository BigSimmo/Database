import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MockupsLayoutClient } from "./mockups-layout-client";

// Design-exploration prototypes: shipped for shareability, but never indexed
// (belt-and-braces alongside the robots.ts /mockups/ disallow).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MockupsLayout({ children }: { children: ReactNode }) {
  return <MockupsLayoutClient>{children}</MockupsLayoutClient>;
}
