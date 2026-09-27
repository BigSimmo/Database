import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "Family | First Nations | PsychSift",
  description: "Family: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsFamilyRoute() {
  return <FirstNationsPageRenderer pageId="family" />;
}
