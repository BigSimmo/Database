import { BookOpen, GitCompareArrows, LibraryBig, List, Quote, Tags } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate } from "@/components/mode-home-template";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { dictionaryEntries, dictionaryTopics } from "@/lib/dictionary-data";

export function DictionaryHomePage() {
  return (
    <ModeHomeMain testId="dictionary-home-main" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="dictionary-home"
        title="Dictionary"
        subtitle="Source-governed psychiatric terms, abbreviations, and distinctions."
        icon={BookOpen}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Dictionary tasks"
        actions={[
          {
            title: "Search terms",
            description: "Find definitions, abbreviations, and topics",
            icon: Quote,
            href: "/dictionary/search",
          },
          {
            title: "Browse A–Z",
            description: `Scan all ${dictionaryEntries.length} canonical entries`,
            icon: List,
            href: "/dictionary/browse",
          },
          {
            title: "Abbreviations",
            description: "Resolve governed abbreviations and ambiguity",
            icon: Tags,
            href: "/dictionary/browse?view=abbreviations",
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
