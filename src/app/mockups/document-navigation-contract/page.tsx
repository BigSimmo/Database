import type { Metadata } from "next";

import { DocumentNavigationContractMockups } from "@/components/document-navigation-contract-mockups";

export const metadata: Metadata = {
  title: "Document navigation against the chrome contract - PsychSift",
  description:
    "Two complete document-navigation candidates at desktop, tablet, and phone, built to the shipped header and footer behaviour.",
};

export default function DocumentNavigationContractMockupPage() {
  return <DocumentNavigationContractMockups />;
}
