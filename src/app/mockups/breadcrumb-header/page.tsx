import type { Metadata } from "next";

import { BreadcrumbHeaderMockups } from "@/components/breadcrumb-header-mockups";

export const metadata: Metadata = {
  title: "Breadcrumb header · mockups",
  description: "Three sticky header directions for record pages that have no in-page section index.",
};

export default function BreadcrumbHeaderMockupsPage() {
  return <BreadcrumbHeaderMockups />;
}
