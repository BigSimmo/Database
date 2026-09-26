import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "Talking | First Nations | PsychSift",
  description: "Talking: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsTalkingRoute() {
  return <FirstNationsPageRenderer pageId="talking" />;
}
