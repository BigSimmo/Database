import type { Metadata } from "next";

import { FavouritesPageMockupPage } from "@/components/favourites-page-mockups";

export const metadata: Metadata = {
  title: "Favourites Library View Mockup - Clinical KB",
  description: "Dense searchable favourites library mockup for Clinical KB.",
};

export default function FavouritesLibraryViewMockupRoute() {
  return <FavouritesPageMockupPage variant="library-view" />;
}
