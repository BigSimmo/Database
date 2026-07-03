import type { Metadata } from "next";

import { ToolsClinicalLanesMockup } from "@/components/tools-page-mockups/rectangle-direction-mockups";

export const metadata: Metadata = {
  title: "Tools Clinical Lanes Mockup - Clinical KB",
  description: "Rectangle-first clinical lane Tools page mockup for Clinical KB.",
};

export default function ToolsClinicalLanesMockupRoute() {
  return <ToolsClinicalLanesMockup />;
}
