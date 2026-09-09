import type { Metadata } from "next";

import { DocumentPhoneZeroChromeMockups } from "@/components/document-phone-zero-chrome-mockups";

export const metadata: Metadata = {
  title: "Document phone navigation, zero new chrome - PsychSift",
  description:
    "Section navigation on the document page that adds no permanent phone chrome and no second scroll owner.",
};

export default function DocumentPhoneZeroChromeMockupPage() {
  return <DocumentPhoneZeroChromeMockups />;
}
