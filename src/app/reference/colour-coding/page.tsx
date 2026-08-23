import type { Metadata } from "next";

import { NavigationBackButton } from "@/components/navigation-back-button";
import { ColourCodingReferenceContent } from "@/components/reference/colour-coding-reference-content";
import { SHARED_APP_HOME_ROUTE } from "@/lib/reference-routes";
import { cn, searchPageCanvas, searchPageContainer, searchPageShellStandalone } from "@/components/ui-primitives";

export const metadata: Metadata = {
  title: "Colour coding reference — Clinical KB",
  description:
    "The site-wide badge colour system: what each tone means and which signals are flagged in each content area.",
};

export default function ColourCodingReferencePage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        searchPageCanvas,
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
      )}
    >
      <div className={cn(searchPageShellStandalone)}>
        <div className={cn(searchPageContainer, "space-y-6")}>
          <div className="flex min-h-tap items-center">
            <NavigationBackButton fallbackHref={SHARED_APP_HOME_ROUTE} />
          </div>
          <ColourCodingReferenceContent variant="page" />
        </div>
      </div>
    </main>
  );
}
