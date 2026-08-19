import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { mockupsEnabled } from "@/lib/env";
import { DEVELOPER_AREA_HEADER } from "@/lib/developer-area/headers";
import { PRIVATE_APP_ROBOTS_METADATA } from "@/lib/crawler-policy";

import { MockupsLayoutClient } from "./mockups-layout-client";
import "./mockups.css";

// Design-exploration prototypes: shipped for shareability, but never indexed.
export const metadata: Metadata = {
  robots: PRIVATE_APP_ROBOTS_METADATA,
};

export default async function MockupsLayout({ children }: { children: ReactNode }) {
  // src/proxy.ts already blocks every /mockups/** path in production (the real
  // gate). This is defense-in-depth for direct/dev-server access — except the
  // two developer-gated subtrees, which proxy marks via this header so they can
  // reach their own signed-in-administrator gate (`DeveloperAreaGate`) instead
  // of a bare 404. The header is proxy-only: any client-supplied copy of it is
  // stripped before this point, so it cannot be spoofed.
  const isDeveloperGatedArea = (await headers()).get(DEVELOPER_AREA_HEADER) === "1";
  if (!mockupsEnabled() && !isDeveloperGatedArea) {
    notFound();
  }
  return <MockupsLayoutClient>{children}</MockupsLayoutClient>;
}
