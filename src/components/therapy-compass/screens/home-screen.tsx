"use client";

import { GitCompareArrows, Network, Sparkles, Waypoints } from "lucide-react";
import { useRouter } from "next/navigation";

import { ModeHomeMain, ModeHomeTemplate } from "@/components/mode-home-template";
import { appModeIcons } from "@/lib/app-mode-icons";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { therapyHrefWithSearchParams, therapyScreenHref } from "@/lib/therapy-compass-navigation";
import { sharedHomePresentation } from "@/lib/ui-copy";

import { TherapyReviewNotice } from "../therapy-review-notice";

import { THERAPY_CATALOGUE_SUMMARY } from "../data/generated-assets";

const SUGGESTIONS = sharedHomePresentation["therapy-compass"].suggestions;

export function HomeScreen() {
  const router = useRouter();
  const therapyCount: number = THERAPY_CATALOGUE_SUMMARY.totalCount;

  const therapyCountCopy =
    therapyCount === 0
      ? "Source-grounded therapy records."
      : `${therapyCount} source-grounded therapy ${therapyCount === 1 ? "record" : "records"}.`;

  return (
    <ModeHomeMain testId="therapy-compass-home" contentAlign="startOnPhone">
      {/* Above the hero, not in the footer: the catalogue-wide review caveat is
          the first thing a reader of this library needs, and the quiet footer
          line is not load-bearing enough to carry it alone. */}
      <TherapyReviewNotice className="mb-3 sm:mb-4" />
      <ModeHomeTemplate
        testId="therapy-compass"
        title={sharedHomePresentation["therapy-compass"].title}
        subtitle={therapyCountCopy}
        // The mode's identity glyph is derived from APP_MODE_ICON rather than
        // chosen here, so this medallion cannot drift from the one nav, the mode
        // picker and the shared home `/` all render. It was a hard-coded magnifier,
        // which made the same mode show two different identities by door.
        icon={appModeIcons["therapy-compass"]}
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
