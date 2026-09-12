"use client";

import { useRouter } from "next/navigation";
import { SafeBoldText } from "@/components/SafeBoldText";
import { sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import { Citation, CitationList } from "@/components/ui/citation";
import { cn } from "@/components/ui-primitives";
import type { ProjectedAnswerSection } from "@/components/clinical-dashboard/answer-section-projector";

export function AnswerInlineSections({ sections }: { sections: ProjectedAnswerSection[] }) {
  const router = useRouter();
  if (sections.length === 0) return null;

  return (
    <div data-testid="adaptive-answer-sections" className="space-y-4 pt-4">
      {sections.map((section, sectionIndex) => (
        <section
          key={`${section.kind ?? "section"}:${sectionIndex}:${section.heading}`}
          data-testid="adaptive-answer-section"
          data-answer-section-kind={section.kind ?? "unspecified"}
          className={cn(
            "min-w-0 border-t border-[color:var(--border)] pt-4",
            section.kind === "source_gap" || section.kind === "source_conflict"
              ? "border-[color:var(--warning-border)]"
              : undefined,
          )}
        >
          <h3 className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{section.heading}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--text-heading)]">
            <SafeBoldText text={section.body} />
          </p>
          {section.kind === "source_gap" && section.citationSources.length === 0 ? null : (
            <CitationList
              label={`Sources for ${section.heading}`}
              className="mt-2"
              citations={section.citationSources.map((source, citationIndex) => ({
                id: source.id,
                citation: (
                  <Citation
                    index={citationIndex + 1}
                    label={source.title || source.file_name}
                    locator={source.page_number == null ? undefined : `p. ${source.page_number}`}
                    status={source.source_metadata?.document_status}
                    onActivate={() => router.push(sourceResultHref(source))}
                  />
                ),
              }))}
            />
          )}
        </section>
      ))}
    </div>
  );
}
