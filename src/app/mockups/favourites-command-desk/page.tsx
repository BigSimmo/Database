import type { Metadata } from "next";

import { FavouritesPageMockupPage } from "@/components/favourites-page-mockups";

export const metadata: Metadata = {
  title: "Favourites Command Desk Mockup - Clinical KB",
  description: "Resume-first favourites page mockup for Clinical KB.",
};

export default function FavouritesCommandDeskMockupRoute() {
  return <FavouritesPageMockupPage variant="command-desk" />;
}
