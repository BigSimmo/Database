"use client";

import { useRouter } from "next/navigation";
import { BookOpenText, Landmark, LibraryBig, Scale } from "lucide-react";

import { ModeHomeTemplate } from "@/components/mode-home-template";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { sharedHomePresentation } from "@/lib/ui-copy";

/**
 * The Sources mode home.
 *
 * `/sources` was already registered as a standalone mode home
 * (`standaloneModeHomePaths`) and given `desktopSearchPlacement: "hero"`, but it
 * rendered the catalogue, which mounts no composer slot — so the shell portalled
 * its search field at a host that did not exist. `desktopComposerSlotId` below is
 * that host; the catalogue now lives at `/sources/search` like every other mode's
 * results surface.
 *
 * Copy is read from `sharedHomePresentation.sources` rather than restated, so this
 * home and the shared home at `/?mode=sources` cannot describe the mode
 * differently.
 */

const catalogueActions = [
  {
    title: "Catalogue",
    description: "Every registered source, filtered by quality band, jurisdiction, publisher or lifecycle.",
    icon: LibraryBig,
    href: "/sources/search",
    testId: "sources-home-catalogue",
  },
  {
    title: "Topics",
    description: "Browse the clinical topics derived from registered source metadata.",
    icon: BookOpenText,
    href: "/sources/topics",
    testId: "sources-home-topics",
  },
  {
    title: "Publishers",
    description: "Publishing bodies grouped by jurisdiction scope, from national to local.",
    icon: Landmark,
    href: "/sources/publishers",
    testId: "sources-home-publishers",
  },
  {
    title: "Method",
    description: "How the catalogue rates, reviews and traces a source, and what it cannot tell you.",
    icon: Scale,
    href: "/sources/method",
    testId: "sources-home-method",
  },
];

export function SourcesHomeClient() {
  const router = useRouter();

  return (
    <ModeHomeTemplate
      testId="sources-home"
      title={sharedHomePresentation.sources.title}
      subtitle={sharedHomePresentation.sources.subtitle}
      icon={appModeIcons.sources}
      headingLevel={2}
      desktopComposerSlotId={modeHomeDesktopComposerSlotId}
      actionsLabel="Browse the catalogue"
      actions={catalogueActions}
      pillsTitle="Common searches"
      pills={sharedHomePresentation.sources.suggestions.map((suggestion) => ({
        label: suggestion,
        onClick: () => router.push(appModeHomeHref("sources", { query: suggestion, run: true })),
      }))}
    />
  );
}
