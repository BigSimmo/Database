import type { Metadata } from "next";

import { CategoryFilterDirectionsMockupsPage } from "@/components/category-filter-directions-mockups";

export const metadata: Metadata = {
  title: "Category Filter Directions Mockup - Clinical KB",
  description: "Design study: replace the phone Category native-select blue highlight with improved filter patterns.",
};

export default function CategoryFilterDirectionsMockupRoute() {
  return <CategoryFilterDirectionsMockupsPage />;
}
