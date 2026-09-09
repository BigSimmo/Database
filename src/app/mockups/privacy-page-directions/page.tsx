import type { Metadata } from "next";

import { PrivacyPageDirectionsMockups } from "@/components/privacy-page-directions-mockups";

export const metadata: Metadata = {
  title: "Privacy page directions - PsychSift",
  description:
    "Three elevated redesign directions for /privacy with desktop and phone frames, grounded in Clinical White / Sky Graphite.",
};

export default function PrivacyPageDirectionsMockupPage() {
  return <PrivacyPageDirectionsMockups />;
}
