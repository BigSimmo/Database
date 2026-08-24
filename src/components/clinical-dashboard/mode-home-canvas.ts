import { cn } from "@/components/ui-primitives";
import type { AppModeResultKind } from "@/lib/app-modes";

type ModeHomeCanvasClassInput = {
  activeModeResultKind: AppModeResultKind;
  centeredModeHome: boolean;
  compactMobileModeHome: boolean;
  hasAnswer: boolean;
  showSharedHome: boolean;
};

/**
 * Keeps the shared dashboard's phone-home geometry outside the render monolith.
 * The flex column fills the already-padded main pane, while only centred homes
 * gain flex centring. Registry homes retain their previous top alignment.
 */
export function resolveModeHomeCanvasClass({
  activeModeResultKind,
  centeredModeHome,
  compactMobileModeHome,
  hasAnswer,
  showSharedHome,
}: ModeHomeCanvasClassInput): string {
  return cn(
    compactMobileModeHome
      ? cn(
          "max-sm:flex max-sm:grow max-sm:shrink-0 max-sm:flex-col sm:min-h-[calc(100dvh-11rem)]",
          centeredModeHome && "max-sm:items-center max-sm:justify-center",
        )
      : activeModeResultKind === "answer" && hasAnswer
        ? "sm:min-h-[calc(100dvh-11rem)]"
        : "min-h-[calc(100dvh-12.5rem)] sm:min-h-[calc(100dvh-11rem)]",
    centeredModeHome || showSharedHome
      ? compactMobileModeHome
        ? "w-full sm:grid sm:place-items-center"
        : "grid w-full place-items-center max-sm:pt-2"
      : activeModeResultKind === "tools" ||
          activeModeResultKind === "favourites" ||
          activeModeResultKind === "differentials"
        ? "mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden"
        : activeModeResultKind === "documents" ||
            activeModeResultKind === "services"
          ? "mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden"
          : "mx-auto w-full max-w-3xl space-y-4 overflow-x-hidden",
  );
}
