import type { Metadata } from "next";

import { GuideHelpHubMockup } from "@/components/guide-wireframe-mockups";

export const metadata: Metadata = {
  title: "Guide Help Hub Wireframe - Clinical KB",
  description: "Option B wireframe: fullscreen TOC help hub with nested citation demo sheet.",
};

export default function GuideHelpHubMockupRoute() {
  return <GuideHelpHubMockup />;
}
