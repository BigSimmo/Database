import type { Metadata } from "next";

import { MyWorkHome } from "@/components/my-work/my-work-home";

export const metadata: Metadata = {
  title: "My Work | PsychSift",
  description: "Paperwork, deadlines and checks: admin, compliance, your shifts and reminders, with what is due first.",
};

/**
 * The My Work mode home: a dashboard, not a redirect stub.
 *
 * My Work gathers pages that keep their own addresses (mostly On Call's admin
 * pages) rather than owning content. Like Psychiatry it declares no search
 * surface (`resultsSurface: "none"`), so it renders a body here instead of
 * forwarding to the shared search home.
 */
export default function MyWorkHomeRoute() {
  return <MyWorkHome />;
}
