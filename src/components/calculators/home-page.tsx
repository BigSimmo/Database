import { Calculator, CloudRain, GlassWater, Search, Zap } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

const calculatorQuickLinks = ["PHQ-9", "GAD-7", "K10", "MDQ", "AUDIT-C"] as const;

function calculatorSearchHref(query: string) {
  return appModeHomeHref("calculators", { query, run: true });
}

export function CalculatorsHomePage() {
  return (
    <ModeHomeMain testId="calculators-home-main" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="calculators-home"
        title="Clinical Calculators"
        subtitle="Validated psychiatry scores with the indication, items, and next actions in one place."
        icon={Calculator}
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
        footer={
          <ModeHomeVerificationFooter
            label="Source-cited scoring"
            body="Scores support clinical judgement and never replace a full assessment. Nothing entered here is stored."
          />
        }
      />
    </ModeHomeMain>
  );
}
