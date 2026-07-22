"use client";

import { FileText, Network, Search, ShieldCheck, Sparkles, Waypoints } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

import { useTcBindings } from "../bindings";
import { LoadingState } from "../ui";

const SUGGESTIONS = [
  "Anxiety in outpatient care",
  "Low mood & motivation",
  "Trauma-focused",
  "5-minute grounding",
  "Relapse prevention",
];

export function HomeScreen() {
  const b = useTcBindings();

  // Avoid presenting an empty or fabricated catalogue while required data loads.
  if (b.loading && b.therapies.length === 0) {
    return <LoadingState label="Loading therapy library…" />;
  }

  const therapyCountCopy =
    b.therapies.length === 0
      ? "Source-grounded therapy records."
      : `${b.therapies.length} source-grounded therapy ${b.therapies.length === 1 ? "record" : "records"}.`;

  return (
    <ModeHomeMain testId="therapy-compass-home" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="therapy-compass"
        title="Therapy mode"
        subtitle={therapyCountCopy}
        icon={Search}
        actionsLabel="Therapy workflows"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actions={[
          {
            title: "Recommend a therapy",
            description: "Match a clinical question to indexed options.",
            icon: Sparkles,
            href: "/therapy-compass/recommend",
          },
          {
            title: "Open a pathway",
            description: "Problem-based, step-by-step workflows.",
            icon: Waypoints,
            href: "/therapy-compass/pathways",
          },
          {
            title: "Create a patient sheet",
            description: "Design and print a plain-language handout.",
            icon: FileText,
            onClick: b.goSheets,
          },
        ]}
        pillsTitle="Common therapy searches"
        pills={SUGGESTIONS.map((suggestion) => ({
          label: suggestion,
          onClick: () => b.submitQuery(suggestion),
          icon: Network,
        }))}
        footer={
          <ModeHomeVerificationFooter
            icon={ShieldCheck}
            label="Decision support"
            body="Source-grounded — review status before clinical use"
          />
        }
      />
    </ModeHomeMain>
  );
}
