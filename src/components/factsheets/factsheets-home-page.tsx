import { ModeHomeMain, ModeHomeTemplate } from "@/components/mode-home-template";
import { appModeIcons } from "@/lib/app-mode-icons";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { sharedHomePresentation } from "@/lib/ui-copy";

export function FactsheetsHomePage() {
  return (
    <ModeHomeMain testId="factsheets-home-main">
      <ModeHomeTemplate
        testId="factsheets-home"
        title={sharedHomePresentation.factsheets.title}
        subtitle={sharedHomePresentation.factsheets.subtitle}
        icon={appModeIcons.factsheets}
        actions={[]}
        actionsLabel="Factsheets actions"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
      />
    </ModeHomeMain>
  );
}
