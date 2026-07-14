import { BookOpenCheck, GitCompareArrows, ListChecks, Search, ShieldCheck } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { dsmCategories, dsmDiagnoses } from "@/lib/dsm";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

const featuredCategories = dsmCategories
  .slice()
  .sort((left, right) => right.diagnosis_count - left.diagnosis_count)
  .slice(0, 5);

export function DsmHomePage() {
  return (
    <ModeHomeMain testId="dsm-home-main">
      <ModeHomeTemplate
        testId="dsm-home"
        title="DSM-5 Diagnosis"
        subtitle="Find diagnostic criteria, review specifiers, compare diagnoses, and clarify differential considerations."
        icon={BookOpenCheck}
        actionsLabel="DSM-5 Diagnosis actions"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actions={[
          {
            title: "Search diagnoses",
            description: "By diagnosis, ICD code, criteria, or category.",
            icon: Search,
            href: "/dsm/search",
            testId: "dsm-home-search",
          },
          {
            title: "Compare diagnoses",
            description: "Review core distinctions side by side.",
            icon: GitCompareArrows,
            href: "/dsm/compare",
            testId: "dsm-home-compare",
          },
          {
            title: "Review core criteria",
            description: "Open a complete, scan-friendly diagnosis record.",
            icon: ListChecks,
            href: "/dsm/diagnoses/major-depressive-disorder",
            testId: "dsm-home-criteria",
          },
        ]}
        pillsTitle="Browse categories"
        pills={featuredCategories.map((category) => ({
          label: `${category.label} · ${category.diagnosis_count}`,
          shortLabel: category.label,
          href: `/dsm/search?category=${category.key}`,
          icon: BookOpenCheck,
        }))}
        footer={
          <ModeHomeVerificationFooter
            icon={ShieldCheck}
            label={`${dsmDiagnoses.length} diagnoses`}
            body="Local reference content · Clinical review required"
          />
        }
      />
    </ModeHomeMain>
  );
}
