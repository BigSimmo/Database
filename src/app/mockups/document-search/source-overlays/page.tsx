import type { Metadata } from "next";

import { SourceOverlayRedesignMockups } from "@/components/source-overlay-redesign-mockups";

export const metadata: Metadata = {
  title: "Source Overlay Redesign Mockups - Clinical KB",
  description: "Document scope and source library overlay redesign mockups for desktop and phone.",
};

export default function SourceOverlayRedesignMockupsRoute() {
  return <SourceOverlayRedesignMockups />;
}
