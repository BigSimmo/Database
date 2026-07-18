"use client";

import { FileText, Network, Search, ShieldCheck, Sparkles, Waypoints } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

import { useTcBindings } from "../bindings";

const SUGGESTIONS = [
  "Anxiety in outpatient care",
  "Low mood & motivation",
  "Trauma-focused",
  "5-minute grounding",
  "Relapse prevention",
];

export function HomeScreen() {
  const b = useTcBindings();

  return (
    <ModeHomeMain testId="therapy-compass-home" className="justify-start sm:justify-center">
      <ModeHomeTemplate
        testId="therapy-compass"
        title="What therapy are you looking for?"
        subtitle={`Search ${b.therapies.length || "200+"} source-grounded therapy records by problem, symptom, skill or population — or jump into a clinical pathway.`}
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
