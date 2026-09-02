import type { Metadata } from "next";

import { ToolsClinicalLanesMockup } from "@/components/tools-page-mockups/rectangle-direction-mockups";

export const metadata: Metadata = {
  title: "Tools Clinical Lanes Mockup - PsychSift",
  description: "Rectangle-first clinical lane Tools page mockup for PsychSift.",
};

export default function ToolsClinicalLanesMockupRoute() {
  return <ToolsClinicalLanesMockup />;
}
