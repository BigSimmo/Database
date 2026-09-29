import type { Metadata } from "next";
import { FirstNationsPageRenderer } from "@/components/first-nations/page-renderer";

export const metadata: Metadata = {
  title: "Contacts | First Nations | PsychSift",
  description: "Contacts: culturally safe care for Aboriginal and Torres Strait Islander patients.",
};

export default function FirstNationsContactsRoute() {
  return <FirstNationsPageRenderer pageId="contacts" />;
}
