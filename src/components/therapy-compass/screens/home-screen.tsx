"use client";

import { GitCompareArrows, Network, Search, Sparkles, Waypoints } from "lucide-react";
import { useRouter } from "next/navigation";

import { ModeHomeMain, ModeHomeTemplate } from "@/components/mode-home-template";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { therapyHrefWithSearchParams, therapyScreenHref } from "@/lib/therapy-compass-navigation";

import { THERAPY_CATALOGUE_SUMMARY } from "../data/generated-assets";

const SUGGESTIONS = [
  "Anxiety in outpatient care",
  "Low mood & motivation",
  "Trauma-focused",
  "5-minute grounding",
  "Relapse prevention",
];

export function HomeScreen() {
  const router = useRouter();
  const therapyCount: number = THERAPY_CATALOGUE_SUMMARY.totalCount;

  const therapyCountCopy =
    therapyCount === 0
      ? "Source-grounded therapy records."
      : `${therapyCount} source-grounded therapy ${therapyCount === 1 ? "record" : "records"}.`;

  return (
    <ModeHomeMain testId="therapy-compass-home" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="therapy-compass"
        title="Therapy"
        subtitle={therapyCountCopy}
        icon={Search}
        actionsLabel="Therapy workflows"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actions={[
          {
            title: "Recommend a therapy",
            description: "Match a clinical question to indexed options.",
            icon: Sparkles,
            href: therapyScreenHref("recommend"),
          },
          {
            title: "Open a pathway",
            description: "Problem-based, step-by-step workflows.",
            icon: Waypoints,
            href: therapyScreenHref("pathways"),
          },
          {
            title: "Compare therapies",
            description: "Compare clinical fit, cautions and delivery.",
            icon: GitCompareArrows,
            href: therapyScreenHref("compare"),
          },
        ]}
        pillsTitle="Common therapy searches"
        pills={SUGGESTIONS.map((suggestion) => ({
          label: suggestion,
          onClick: () =>
            router.push(
              therapyHrefWithSearchParams(
                therapyScreenHref("search"),
                new URLSearchParams({ q: suggestion, run: "1" }),
              ),
            ),
          icon: Network,
        }))}
      />
    </ModeHomeMain>
  );
}
