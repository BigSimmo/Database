import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "Common mistakes | First Nations | PsychSift",
  description: "Common mistakes: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsMistakesRoute() {
  return <FirstNationsPageRenderer pageId="mistakes" />;
}
