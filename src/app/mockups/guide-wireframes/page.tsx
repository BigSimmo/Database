import type { Metadata } from "next";

import { GuideWireframesIndex } from "@/components/guide-wireframe-mockups";

export const metadata: Metadata = {
  title: "Guide Wireframes - Clinical KB",
  description:
    "Three design-scratch wireframe options for the Clinical KB in-app guide, with phone and desktop Sheet states.",
};

export default function GuideWireframesIndexRoute() {
  return <GuideWireframesIndex />;
}
