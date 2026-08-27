import { BookOpenCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { InformationPageBreadcrumbs } from "@/components/information-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { cn, codeText, metadataPill, pageContainer } from "@/components/ui-primitives";
import { dsmSearchHref } from "@/lib/app-modes";

export function DsmPageHeader({
  eyebrow = "DSM-5 Diagnosis",
  title,
  description,
  code,
  category,
  actions,
  className,
  breadcrumb = true,
  homeIcon,
  icon = BookOpenCheck,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  code?: string;
  category?: string;
  actions?: ReactNode;
  className?: string;
  /**
   * Opt out on a page that owns an `InPageNavHeader`: that header's back
   * control is already the route out to the mode home, and a breadcrumb row
   * under it is a second one. The `<h1>` below stays either way — the shared
   * header's title is a `<span>`.
   */
  breadcrumb?: boolean;
  homeIcon?: LucideIcon | false;
  icon?: LucideIcon | false;
}) {
  return (
    <div className={cn("border-b border-[color:var(--border)] bg-[color:var(--surface)]", className)}>
      <div className={cn(pageContainer, "px-4 py-4 sm:px-6 sm:py-5 lg:px-8")}>
        {/* One breadcrumb nav per page: the mode-home back-link stays with
            `InformationPageBreadcrumbs` (now itself a `Breadcrumb`), so the
            `PageHeader` below is not given a second `breadcrumb` of its own. */}
        {breadcrumb ? (
          <InformationPageBreadcrumbs
            home={{ label: "DSM search", href: dsmSearchHref }}
            homeIcon={homeIcon}
            className="mb-3"
          />
        ) : null}
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          icon={icon === false ? undefined : icon}
          actions={actions}
          meta={
            code || category ? (
              <>
                {code ? <span className={cn(metadataPill, codeText)}>{code}</span> : null}
                {category ? <span className={metadataPill}>{category}</span> : null}
                <span className={metadataPill}>Local clinical reference</span>
              </>
            ) : null
          }
        />
      </div>
    </div>
  );
}
