import { CloudRain, GlassWater, Search, Zap } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate } from "@/components/mode-home-template";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { sharedHomePresentation } from "@/lib/ui-copy";

const calculatorQuickLinks = ["PHQ-9", "GAD-7", "K10", "MDQ", "AUDIT-C"] as const;

function calculatorSearchHref(query: string) {
  return appModeHomeHref("calculators", { query, run: true });
}

export function CalculatorsHomePage() {
  return (
    <ModeHomeMain testId="calculators-home-main" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="calculators-home"
        title={sharedHomePresentation.calculators.title}
        subtitle={sharedHomePresentation.calculators.subtitle}
        icon={appModeIcons.calculators}
        actionsLabel="Starter calculator searches"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actions={[
          {
            title: "Depression severity",
            description: "Find screening and symptom-severity scales.",
            icon: CloudRain,
            href: calculatorSearchHref("depression"),
          },
          {
            title: "Anxiety & OCD",
            description: "Find anxiety and obsessive-compulsive measures.",
            icon: Zap,
            href: calculatorSearchHref("anxiety"),
          },
          {
            title: "Alcohol use",
            description: "Find brief alcohol-use screening tools.",
            icon: GlassWater,
            href: calculatorSearchHref("alcohol use"),
          },
        ]}
        pillsTitle="Open a calculator"
        pills={calculatorQuickLinks.map((label) => ({
          label,
          href: calculatorSearchHref(label),
          icon: Search,
        }))}
      />
    </ModeHomeMain>
  );
}
