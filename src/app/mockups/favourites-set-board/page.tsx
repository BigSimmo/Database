import type { Metadata } from "next";

import { FavouritesPageMockupPage } from "@/components/favourites-page-mockups";

export const metadata: Metadata = {
  title: "Favourites Set Board Mockup - Clinical KB",
  description: "Workflow-set favourites page mockup for Clinical KB.",
};

export default function FavouritesSetBoardMockupRoute() {
  return <FavouritesPageMockupPage variant="set-board" />;
}
