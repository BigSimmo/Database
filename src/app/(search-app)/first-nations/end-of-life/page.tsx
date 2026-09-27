import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "End of life | First Nations | PsychSift",
  description: "End of life: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsEndOfLifeRoute() {
  return <FirstNationsPageRenderer pageId="end-of-life" />;
}
