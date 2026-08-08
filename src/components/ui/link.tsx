"use client";

import { ArrowRight, Download, ExternalLink } from "lucide-react";
import NextLink from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui-primitives";

type BaseProps = {
  children: ReactNode;
  className?: string;
  /** Quiet links inherit ink and underline on hover; loud links are always accented. */
  tone?: "accent" | "inherit";
};

const base =
  "inline-flex items-baseline gap-1 rounded-sm underline-offset-[3px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const toneClass = {
  accent:
    "text-[color:var(--clinical-accent)] underline decoration-[color:var(--clinical-accent)]/35 hover:decoration-[color:var(--clinical-accent)]",
  inherit: "text-inherit no-underline hover:underline",
} as const;

export type TextLinkProps = BaseProps & { href: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "children" | "className"
  >;

export type ExternalTextLinkProps = BaseProps & { href: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "children" | "className" | "rel" | "target"
  >;

export type DownloadLinkProps = BaseProps & { href: string; format?: string; size?: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    // `download` is the component. A caller that could pass `download={false}`
    // would get a link that navigates away from the app to a raw asset URL while
    // still rendering the download glyph and the "(PDF, 40 MB)" detail — the
    // affordance says one thing and the anchor does another.
    "href" | "children" | "className" | "download"
  >;

export type LinkActionProps = BaseProps & { href: string };

/**
 * Internal navigation. Wraps `next/link` so a call site never reaches for a raw
 * `<a href="/…">` — which loses client-side routing, prefetch and scroll
 * restoration, and which `docs/wiring-conventions.md` bans without previously
 * offering an alternative.
 */
export function TextLink({ href, children, tone = "accent", className, ...props }: TextLinkProps) {
  return (
    <NextLink href={href} className={cn(base, toneClass[tone], className)} {...props}>
      {children}
    </NextLink>
  );
}

/**
 * A link that leaves the app. Three things are non-negotiable and are therefore
 * not props:
 *
 *   - `rel="noopener noreferrer"` — `target="_blank"` without it hands the
 *     opened page a live `window.opener` handle back into a clinical app.
 *   - A visible indicator glyph, so "this leaves the app" is not conveyed by
 *     hover alone.
 *   - An `sr-only` "opens in a new tab", because an unannounced context switch
 *     is disorienting for screen-reader and switch users.
 */
export function ExternalTextLink({ href, children, tone = "accent", className, ...props }: ExternalTextLinkProps) {
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, toneClass[tone], className)}
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-icon-xs shrink-0 self-center" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/**
 * A link that produces a file. States the format and size up front — a clinician
 * on hospital wifi deciding whether to tap a 40 MB PDF needs that before the tap,
 * not after.
 */
export function DownloadLink({
  href,
  children,
  format,
  size,
  tone = "accent",
  className,
  ...props
}: DownloadLinkProps) {
  const detail = [format, size].filter(Boolean).join(", ");
  return (
    // Spread first, then the invariants. The reverse order let a spread win, so
    // the type is the first guard and the ordering is the second.
    <a {...props} href={href} download className={cn(base, toneClass[tone], className)}>
      <Download aria-hidden="true" className="size-icon-xs shrink-0 self-center" />
      {children}
      {detail ? (
        <span className="nums text-xs font-normal text-[color:var(--text-muted)] no-underline">({detail})</span>
      ) : null}
    </a>
  );
}

/**
 * A link styled as the forward action of a card or section. Not a button: it
 * navigates, so it must be a real anchor for middle-click, copy-link, and the
 * browser's own affordances.
 */
export function LinkAction({ href, children, className }: LinkActionProps) {
  return (
    <NextLink
      href={href}
      className={cn(
        "group inline-flex min-h-tap items-center gap-1.5 rounded-md text-sm font-semibold text-[color:var(--clinical-accent)] transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        className,
      )}
    >
      {children}
      {/* The nudge is a transform, not `hover:gap-2`.
          `gap` is not in Tailwind's `transition` property list, so the old pair
          never eased — it jumped, reflowing the arrow and everything laid out
          after this link on hover, and its `motion-reduce:hover:gap-1.5` guard
          was reducing a transition that did not exist. `translate-x` composites,
          costs no layout, and honours reduced motion for real. */}
      <ArrowRight
        aria-hidden="true"
        className="size-icon-sm shrink-0 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </NextLink>
  );
}
