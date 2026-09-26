"use client";

import { AdminNavHeader } from "@/components/admin/admin-nav-header";
import { ADMIN_NEW_JOB_SECTIONS } from "@/components/admin/admin-page-sections";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { InformationPageShell } from "@/components/information-page-shell";
import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * New job, the scaffold (Admin update 1, Task 1): the page, its two tabs and an
 * empty section per tab. A later task fills Before and Leaving.
 */
export function AdminNewJobPage() {
  return (
    <>
      <AdminNavHeader title="New job" sections={ADMIN_NEW_JOB_SECTIONS} />
      <InformationPageShell testId="admin-new-job-main">
        <h1 className="sr-only">New job</h1>
        {ADMIN_NEW_JOB_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className={cn(inPageAnchor, "grid gap-3")}
            aria-labelledby={`${section.id}-heading`}
          >
            <h2 id={`${section.id}-heading`} className={eyebrowText}>
              {section.label}
            </h2>
          </section>
        ))}
      </InformationPageShell>
    </>
  );
}
