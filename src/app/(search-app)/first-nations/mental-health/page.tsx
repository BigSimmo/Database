import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "Mental health | First Nations | PsychSift",
  description: "Mental health: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsMentalHealthRoute() {
  return <FirstNationsPageRenderer pageId="mental-health" />;
}
