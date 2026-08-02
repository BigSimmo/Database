import type { Metadata } from "next";

import { GuideTipAtlasMockup } from "@/components/guide-wireframe-mockups";

export const metadata: Metadata = {
  title: "Guide Tip Atlas Wireframe - Clinical KB",
  description: "Option A wireframe: interactive tip-atlas guide with annotated deep-dive sheets.",
};

export default function GuideTipAtlasMockupRoute() {
  return <GuideTipAtlasMockup />;
}
