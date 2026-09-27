"use client";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";

/**
 * Admin's left-aligned underlined tabs: the in-page section rail On Call's pages
 * use, in Admin's brown. The pill above names the page, so the title is hidden
 * (same choice as `OnCallSectionNavHeader`), and there is no back control.
 */
export function AdminNavHeader({ title, sections }: { title: string; sections: readonly PageSection[] }) {
  const { sections: resolved, activeId, selectSection } = useInPageSectionNav(sections);
  if (resolved.length === 0) return null;
  return (
    <InPageNavHeader
      title={title}
      titleHidden
      sections={resolved}
      activeId={activeId}
      onSelectSection={selectSection}
      rail={{ label: "Sections of this page", density: "wordmark-five", modeIdentity: "my-work" }}
      className="max-sm:border-b-0 max-sm:bg-transparent"
      testIdPrefix="admin-section-header"
    />
  );
}
