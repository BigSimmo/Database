import type { Metadata } from "next";

import { CoverageGapsMockups } from "@/components/coverage-gaps-mockups";

export const metadata: Metadata = {
  title: "Coverage gaps mockups - PsychSift",
  description:
    "Four boards for a corpus-coverage report built on redacted telemetry: topics rather than questions, the WA-first source ladder, the abstain blind spot, and closing the loop.",
};

export default function CoverageGapsMockupRoute() {
  return <CoverageGapsMockups />;
}
