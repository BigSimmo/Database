import type { Metadata } from "next";
import { FirstNationsPocketCard } from "@/components/first-nations/pocket-card";

export const metadata: Metadata = {
  title: "Pocket card | First Nations | PsychSift",
  description: "The First Nations pocket card: key numbers and prompts on one printable card.",
};

export default function FirstNationsPocketCardRoute() {
  return <FirstNationsPocketCard />;
}
