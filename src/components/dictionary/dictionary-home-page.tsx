import { GitCompareArrows, LibraryBig, List, Tags } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate } from "@/components/mode-home-template";
import { appModeIcons } from "@/lib/app-mode-icons";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { dictionaryEntries, dictionaryTopics } from "@/lib/dictionary-data";
import { sharedHomePresentation } from "@/lib/ui-copy";

export function DictionaryHomePage() {
  return (
    <ModeHomeMain testId="dictionary-home-main" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="dictionary-home"
        title={sharedHomePresentation.dictionary.title}
        subtitle={sharedHomePresentation.dictionary.subtitle}
        icon={appModeIcons.dictionary}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Dictionary tasks"
        actions={[
          {
            // Search and Browse are one destination: an empty query lists the
            // whole catalogue, a typed one narrows the same list. Two tiles
            // pointing at the same page would only make the reader choose
            // between two words for the same thing.
            title: "Clinical terms",
            description: `Search or browse all ${dictionaryEntries.length} canonical entries`,
            icon: List,
            href: "/dictionary/search",
          },
          {
            title: "Abbreviations",
            description: "Resolve governed abbreviations and ambiguity",
            icon: Tags,
            href: "/dictionary/search?view=abbreviations",
          },
          {
            title: "Clinical topics",
            description: `Explore ${dictionaryTopics.length} scoped collections`,
            icon: LibraryBig,
            href: "/dictionary/topics",
          },
          {
            title: "Compare terms",
            description: "Align two entries field by field",
            icon: GitCompareArrows,
            href: "/dictionary/compare",
          },
        ]}
        pillsTitle="Start with"
        pills={[
          {
            label: "Mental state examination",
            shortLabel: "MSE",
            href: "/dictionary/mental-state-examination",
            tone: "primary",
          },
          { label: "Auditory hallucination", href: "/dictionary/auditory-hallucination", tone: "slate" },
          {
            label: "Acceptance and commitment therapy",
            shortLabel: "ACT meanings",
            href: "/dictionary/search?q=ACT&view=abbreviations",
            tone: "purple",
          },
          { label: "Source governance", shortLabel: "Sources", href: "/dictionary/sources", tone: "info" },
        ]}
      />
    </ModeHomeMain>
  );
}
