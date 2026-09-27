import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "First Nations | PsychSift",
  description: "Culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsHomeRoute() {
  return <FirstNationsPageRenderer pageId="bedside" />;
}
