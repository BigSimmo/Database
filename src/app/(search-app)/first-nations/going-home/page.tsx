import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "Going home | First Nations | PsychSift",
  description: "Going home: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsGoingHomeRoute() {
  return <FirstNationsPageRenderer pageId="going-home" />;
}
