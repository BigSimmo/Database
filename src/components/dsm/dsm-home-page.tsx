import { BookOpenCheck, GitCompareArrows, ListChecks, Search } from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { dsmCategories, dsmDiagnoses } from "@/lib/dsm";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

const featuredCategories = dsmCategories
  .slice()
  .sort((left, right) => right.diagnosis_count - left.diagnosis_count)
  .slice(0, 5);

export function DsmHomePage() {
  return (
    <ModeHomeMain testId="dsm-home-main" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="dsm-home"
        title="DSM-5 Diagnosis"
        subtitle="Criteria, specifiers, and comparisons."
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
        // Every one of these five pills used to carry the same `BookOpenCheck`
        // — the mode's own hero glyph, repeated once per category. A glyph that
        // is identical across every item in a set distinguishes nothing: it is
        // the cost of an icon with none of the benefit, and it competes with the
        // label that is doing the actual work.
        //
        // They are deliberately NOT replaced with one glyph per diagnostic
        // category. Pictograms for DSM-5 chapters are a clinical-content
        // decision, not a design one, and several would be actively wrong to
        // guess at: the puzzle piece conventionally reached for on
        // neurodevelopmental disorders is rejected by many autistic people, and
        // any glyph chosen for the paraphilic, gender-dysphoria or sexual-
        // dysfunction chapters risks reading as a judgement about the people
        // those criteria describe. Without an icon `ModeHomeTemplate` renders a
        // tone dot, so the pills keep a leading mark and the label plus count
        // carry the identity.
        pills={featuredCategories.map((category) => ({
          label: `${category.label} · ${category.diagnosis_count}`,
          shortLabel: category.label,
          href: `/dsm/search?category=${category.key}`,
        }))}
        footer={
          <ModeHomeVerificationFooter
            label={`${dsmDiagnoses.length} diagnoses`}
            body="Local reference content · Clinical review required"
          />
        }
      />
    </ModeHomeMain>
  );
}
