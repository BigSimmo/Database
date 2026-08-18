import { BookOpenText } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

export function FactsheetsHomePage() {
  return (
    <ModeHomeMain testId="factsheets-home-main">
      <ModeHomeTemplate
        testId="factsheets-home"
        title="Factsheets"
        subtitle="Plain-language patient handouts."
        icon={BookOpenText}
        actions={[]}
        actionsLabel="Factsheets actions"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        footer={
          <ModeHomeVerificationFooter
            label="Demonstration patient information"
            body="Connect only governance-approved content before publication"
          />
        }
      />
    </ModeHomeMain>
  );
}
