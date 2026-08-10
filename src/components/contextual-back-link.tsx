"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

type NavigationCapability = {
  canGoBack?: boolean;
};

type WindowWithNavigation = Window & {
  navigation?: NavigationCapability;
};

export function canNavigateBack(): boolean {
  if (typeof window === "undefined") return false;
  const canGoBack = (window as WindowWithNavigation).navigation?.canGoBack;
  return typeof canGoBack === "boolean" ? canGoBack : window.history.length > 1;
}

export function navigateContextuallyBack(
  router: Pick<ReturnType<typeof useRouter>, "back" | "replace">,
  fallbackHref: string,
) {
  if (canNavigateBack()) {
    router.back();
    return;
  }
  router.replace(fallbackHref);
}

function isUnmodifiedPrimaryClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!event.currentTarget.target || event.currentTarget.target === "_self")
  );
}

export type ContextualBackLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  fallbackHref: string;
  /** Return false to keep the user on the current page. */
  onBeforeNavigate?: () => boolean;
  onClick?: ComponentProps<typeof Link>["onClick"];
};

/**
 * A real fallback link for deep links/new tabs that otherwise follows the
 * current tab's browser history. Modified clicks keep normal link semantics.
 */
export function ContextualBackLink({
  fallbackHref,
  onBeforeNavigate,
  onClick,
  children,
  ...props
}: ContextualBackLinkProps) {
  const router = useRouter();

  return (
    <Link
      {...props}
      href={fallbackHref}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (onBeforeNavigate && !onBeforeNavigate()) {
          event.preventDefault();
          return;
        }
        if (!isUnmodifiedPrimaryClick(event)) return;
        event.preventDefault();
        navigateContextuallyBack(router, fallbackHref);
      }}
    >
      {children}
    </Link>
  );
}
