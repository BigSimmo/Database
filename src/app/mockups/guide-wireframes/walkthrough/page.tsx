import type { Metadata } from "next";

import { GuideWalkthroughMockup } from "@/components/guide-wireframe-mockups";

export const metadata: Metadata = {
  title: "Guide Walkthrough Wireframe - Clinical KB",
  description: "Option C wireframe: first-run walkthrough sheet with skip confirm and done state.",
};

export default function GuideWalkthroughMockupRoute() {
  return <GuideWalkthroughMockup />;
}
