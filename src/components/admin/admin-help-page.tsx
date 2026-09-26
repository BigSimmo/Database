"use client";

import { AdminNavHeader } from "@/components/admin/admin-nav-header";
import { ADMIN_HELP_SECTIONS } from "@/components/admin/admin-page-sections";
import { cardSurface, focusRing } from "@/components/card-recipes";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageShell } from "@/components/information-page-shell";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { WA_CRISIS_CONTACTS } from "@/lib/crisis-contacts";

/**
 * The crisis lines Help opens with (spec: "Crisis lines sit at the top, reusing
 * the app's existing crisis list"). Read from `WA_CRISIS_CONTACTS`, the one
 * source every surface that prints a crisis number uses, so a number can never
 * drift. The scaffold prints them plainly; a later task gives them the shared
 * number row.
 */
function AdminCrisisLines() {
  return (
    <ul className="grid gap-1.5" aria-label="Crisis lines" data-testid="admin-help-crisis-lines">
      {WA_CRISIS_CONTACTS.map((contact) => (
        <li key={contact.id}>
          <a
            href={`tel:${contact.telephoneUri}`}
            className={cn(cardSurface, focusRing, "grid min-h-12 gap-0.5 px-3 py-2 no-underline")}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-medium text-[color:var(--text-heading)]">{contact.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-[color:var(--text-heading)]">
                {contact.telephoneDisplay}
              </span>
            </span>
            <span className={cn(textMuted, "text-xs")}>{contact.availability}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Help, the scaffold (Admin update 1, Task 1): the page, its four tabs and a
 * section per tab. Support carries the crisis lines now, so the page is never
 * blank; a later task fills the rest.
 */
export function AdminHelpPage() {
  return (
    <>
      <AdminNavHeader title="Help" sections={ADMIN_HELP_SECTIONS} />
      <InformationPageShell testId="admin-help-main">
        <h1 className="sr-only">Help</h1>
        {ADMIN_HELP_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className={cn(inPageAnchor, "grid gap-3")}
            aria-labelledby={`${section.id}-heading`}
          >
            <h2 id={`${section.id}-heading`} className={eyebrowText}>
              {section.label}
            </h2>
            {section.id === "admin-help-support" ? <AdminCrisisLines /> : null}
          </section>
        ))}
      </InformationPageShell>
    </>
  );
}
