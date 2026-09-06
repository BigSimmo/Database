import type { Metadata } from "next";

import { SpecifierRecordDirectionsMockups } from "@/components/specifier-record-directions-mockups";

export const metadata: Metadata = {
  title: "Specifier record directions - PsychSift",
  description:
    "Three redesign directions for the specifier record page — course matrix, clinical record card, documentation line.",
};

export default function SpecifierRecordDirectionsMockupPage() {
  return <SpecifierRecordDirectionsMockups />;
}
