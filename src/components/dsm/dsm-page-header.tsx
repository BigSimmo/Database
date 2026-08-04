import Link from "next/link";
import { BookOpenCheck, GitCompareArrows, Search } from "lucide-react";
import type { ReactNode } from "react";

import { InformationPageBreadcrumbs } from "@/components/information-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { cn, codeText, metadataPill, pageContainer } from "@/components/ui-primitives";

export function DsmPageHeader({
  eyebrow = "DSM-5 Diagnosis",
  title,
  description,
  code,
  category,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  code?: string;
  category?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-[color:var(--border)] bg-[color:var(--surface)]", className)}>
      <div className={cn(pageContainer, "px-4 py-4 sm:px-6 sm:py-5 lg:px-8")}>
        {/* One breadcrumb nav per page: the mode-home back-link stays with
            `InformationPageBreadcrumbs` (now itself a `Breadcrumb`), so the
            `PageHeader` below is not given a second `breadcrumb` of its own. */}
        <InformationPageBreadcrumbs home={{ label: "DSM-5 Diagnosis home", href: "/dsm" }} className="mb-3" />
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          icon={BookOpenCheck}
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

export function DsmHeaderActions({ compareHref = "/dsm/compare" }: { compareHref?: string }) {
  return (
    <>
      <Link
        href="/dsm/search"
        className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-xs font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)]"
      >
        <Search className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
        Search
      </Link>
      <Link
        href={compareHref}
        className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-xs font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Compare
      </Link>
    </>
  );
}
