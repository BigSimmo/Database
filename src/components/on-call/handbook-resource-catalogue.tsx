import { ExternalLink, NotebookPen, Phone } from "lucide-react";
import Link from "next/link";

import { cardSurface, focusRing } from "@/components/card-recipes";
import { buttonFaceClass } from "@/components/ui/button";
import { cn, textMuted } from "@/components/ui-primitives";
import {
  handbookResourceGroupLabels,
  handbookResources,
  type HandbookResourceGroup,
} from "@/lib/on-call/handbook-resources";

const groups = [
  "contacts",
  "referrals",
  "resources",
  "documentation",
] as const satisfies readonly HandbookResourceGroup[];

function learningHref(title: string, sourceUrl: string): string {
  const query = new URLSearchParams({ title, sourceUrl });
  return `/cme/new?${query.toString()}`;
}

export function HandbookResourceCatalogue({ query = "" }: { readonly query?: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-AU");
  const visibleResources = normalizedQuery
    ? handbookResources.filter((resource) =>
        [
          resource.title,
          resource.jurisdiction,
          resource.whyUseful,
          resource.sourceLabel,
          resource.accessNote ?? "",
        ].some((value) => value.toLocaleLowerCase("en-AU").includes(normalizedQuery)),
      )
    : handbookResources;

  return (
    <section aria-labelledby="official-resources-heading" className="grid gap-4" data-testid="handbook-resources">
      <div>
        <h2 id="official-resources-heading" className="text-lg font-bold text-[color:var(--text-heading)]">
          Official WA starting points
        </h2>
        <p className={cn(textMuted, "mt-1 text-sm leading-6")}>
          Open the publisher page for current details. These links are a practical index, not local policy or clinical
          advice.
        </p>
      </div>

      {groups.map((group) => {
        const resources = visibleResources.filter((resource) => resource.group === group);
        if (resources.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`handbook-${group}-heading`} className="grid gap-2">
            <h3 id={`handbook-${group}-heading`} className="text-sm font-bold text-[color:var(--text-heading)]">
              {handbookResourceGroupLabels[group]}
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {resources.map((resource) => (
                <article key={resource.id} className={cn(cardSurface, "min-w-0 p-4")}>
                  <div className="grid gap-2">
                    <div>
                      <h4 className="break-words text-sm font-bold text-[color:var(--text-heading)]">
                        {resource.title}
                      </h4>
                      <p className={cn(textMuted, "mt-0.5 text-xs")}>{resource.jurisdiction}</p>
                    </div>
                    <p className="break-words text-sm leading-6 text-[color:var(--text)]">{resource.whyUseful}</p>
                    {resource.phone ? (
                      <p className="flex min-h-tap items-center gap-2 text-sm font-semibold text-[color:var(--text)]">
                        <Phone aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
                        <span className="nums break-all">{resource.phone}</span>
                      </p>
                    ) : null}
                    {resource.accessNote ? (
                      <p className={cn(textMuted, "break-words text-xs leading-5")}>{resource.accessNote}</p>
                    ) : null}
                    <p className={cn(textMuted, "text-2xs")}>Source checked {resource.checkedOn}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <a
                        href={resource.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonFaceClass({ size: "sm" }),
                          focusRing,
                          "min-w-0 justify-center whitespace-normal text-center no-underline",
                        )}
                      >
                        <ExternalLink aria-hidden="true" className="size-icon-sm shrink-0" />
                        <span className="min-w-0 break-words">{resource.sourceLabel}</span>
                      </a>
                      <Link
                        href={learningHref(resource.title, resource.sourceUrl)}
                        className={cn(
                          buttonFaceClass({ variant: "ghost", size: "sm" }),
                          focusRing,
                          "min-w-0 justify-center whitespace-normal text-center no-underline",
                        )}
                      >
                        <NotebookPen aria-hidden="true" className="size-icon-sm shrink-0" />
                        Log this learning
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {visibleResources.length === 0 ? (
        <p className={cn(textMuted, "text-sm")}>No official WA starting points match this search.</p>
      ) : null}
    </section>
  );
}
