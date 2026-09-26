import type { Metadata } from "next";

import { PsychiatryHome } from "@/components/psychiatry/psychiatry-home";

export const metadata: Metadata = {
  title: "Psychiatry | PsychSift",
  description: "Diagnosis, specifiers, formulation, therapy and Mental Health Act forms in one place.",
};

/**
 * The Psychiatry mode home: a dashboard of links, not a redirect stub.
 *
 * Psychiatry gathers existing modes rather than owning content, and each of
 * those keeps its own address and search. Like On Call and CME it declares no
 * search surface (`resultsSurface: "none"`), so it renders a body here instead
 * of forwarding to the shared search home.
 */
export default function PsychiatryHomeRoute() {
  return <PsychiatryHome />;
}
