"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode, MouseEvent } from "react";

/**
 * Same-route search-param navigation for DSM compare removals.
 *
 * `<Link>` soft-nav from `/dsm/compare?ids=a,b` → `/dsm/compare?ids=b` can
 * complete its click handler under Production UI load without ever updating
 * the URL (zero network, URL stuck). Explicit `router.push` is the same
 * pattern `useResultSort` uses for pathname-stable query updates.
 */
export function DsmCompareRemoveLink({
  href,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  href: string;
  "aria-label": string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    router.push(href);
  }

  return (
    <Link href={href} aria-label={ariaLabel} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
