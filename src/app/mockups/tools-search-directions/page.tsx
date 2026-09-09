import type { Metadata } from "next";

import { ToolsSearchDirectionsMockups } from "@/components/tools-search-directions-mockups";

export const metadata: Metadata = {
  title: "Tools search directions mockups - PsychSift",
  description: "Three directions for the Tools search results state, built from the real tools catalogue.",
};

export default function ToolsSearchDirectionsMockupRoute() {
  return <ToolsSearchDirectionsMockups />;
}
