import { DifferentialsHome } from "@/components/clinical-dashboard/differentials-home";
import { ModeHomeMain } from "@/components/mode-home-template";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

type DifferentialsHomePageProps = {
  query?: string;
};

export function DifferentialsHomePage({ query = "" }: DifferentialsHomePageProps) {
  return (
    <ModeHomeMain>
      <DifferentialsHome query={query} loading={false} desktopComposerSlotId={modeHomeDesktopComposerSlotId} />
    </ModeHomeMain>
  );
}
