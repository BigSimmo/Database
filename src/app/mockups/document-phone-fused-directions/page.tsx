import type { Metadata } from "next";

import { DocumentPhoneFusedDirectionsMockups } from "@/components/document-phone-fused-directions-mockups";

export const metadata: Metadata = {
  title: "Document phone fused row directions - PsychSift",
  description: "Three directions built on the fused phone title row for the document page.",
};

export default function DocumentPhoneFusedDirectionsMockupPage() {
  return <DocumentPhoneFusedDirectionsMockups />;
}
