import { DifferentialsHome } from "@/components/clinical-dashboard/differentials-home";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

type DifferentialsHomePageProps = {
  query?: string;
};

export function DifferentialsHomePage({ query = "" }: DifferentialsHomePageProps) {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] text-[color:var(--text)]">
      <DifferentialsHome query={query} loading={false} desktopComposerSlotId={modeHomeDesktopComposerSlotId} />
    </main>
  );
}
