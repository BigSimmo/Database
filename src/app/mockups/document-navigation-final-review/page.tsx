import type { Metadata } from "next";

import { DocumentNavigationFinalReviewMockups } from "@/components/document-navigation-final-review-mockups";

export const metadata: Metadata = {
  title: "Document navigation, final review - PsychSift",
  description:
    "Two final document-navigation versions at desktop, tablet, and phone, with every issue from the study resolved.",
};

export default function DocumentNavigationFinalReviewMockupPage() {
  return <DocumentNavigationFinalReviewMockups />;
}
