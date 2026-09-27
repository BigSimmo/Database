import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "On the ward | First Nations | PsychSift",
  description: "On the ward: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsOnTheWardRoute() {
  return <FirstNationsPageRenderer pageId="on-the-ward" />;
}
