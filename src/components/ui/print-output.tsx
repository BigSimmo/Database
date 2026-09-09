"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";

/**
 * The standard footer for a clinical document that leaves the screen. The
 * wording belongs to the primitive rather than to each caller, so two printed
 * documents from this repository cannot make two different promises about how
 * the paper should be handled.
 *
 * The user chose this wording on 25 August 2026, replacing "Handle it, keep it,
 * and dispose of it according to local health service policy." Two of the three
 * sheets carrying this footer are handed to a patient, and on those the old line
 * both contradicted the page and asked for something its reader cannot do: four
 * lines after telling the person to keep the sheet somewhere they can find it
 * quickly, it told them to dispose of it according to a policy they do not hold
 * and cannot consult. This line states the document's status and points handling
 * at local policy without instructing the reader to act on one — which stays
 * exactly right on the clinician's print, where the reader can.
 */
export const CONFIDENTIAL_DOCUMENT_FOOTER = "Confidential clinical document. Handle according to local policy.";

export function BrowserPrintButton({
  label = "Print",
  onBeforePrint,
}: {
  label?: string;
  /**
   * Runs immediately before the browser is asked to print, and only then. A
   * caller that records the request needs it recorded *before* the browser
   * blocks on its own print dialogue; afterwards is too late, because the
   * dialogue may never return. Optional, so a caller that has nothing to record
   * behaves exactly as it did before this existed.
   */
  onBeforePrint?: () => void;
}) {
  return (
    <Button
      variant="primary"
      icon={Printer}
      onClick={() => {
        onBeforePrint?.();
        window.print();
      }}
    >
      {label}
    </Button>
  );
}

/**
 * One block of a printed document that should not be split across a page break,
 * and may optionally start a fresh page.
 *
 * Page-break control belongs here rather than in a caller's stylesheet: the
 * rules act on `data-print-*` attributes declared once in `globals.css`, beside
 * the rules that decide what prints at all, so a document cannot half-adopt the
 * shared print behaviour.
 */
export function PrintSection({
  breakInside = "avoid",
  breakBefore,
  className,
  testId,
  children,
}: {
  /** `avoid` (the default) keeps the block whole; `auto` leaves it to the browser. */
  breakInside?: "avoid" | "auto";
  /** `page` starts this block on a fresh sheet. */
  breakBefore?: "page";
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      data-print-break-inside={breakInside === "avoid" ? "avoid" : undefined}
      data-print-break-before={breakBefore}
      className={className}
    >
      {children}
    </div>
  );
}

export function PrintOutput({
  children,
  className,
  provenance,
  paperTone,
  confidential = false,
  monochrome = false,
  printedAt,
  testId,
}: {
  children: ReactNode;
  className?: string;
  provenance: ReactNode;
  paperTone?: "therapy";
  /** Adds the standard confidential-document footer. Off by default. */
  confidential?: boolean;
  /**
   * Prints without tint, so a state that a tinted background carried on screen
   * is carried by a border and by words on a greyscale printer instead. Off by
   * default, because a document whose colour is decorative should keep it.
   */
  monochrome?: boolean;
  /**
   * When this copy was produced, already formatted by the caller. The primitive
   * deliberately reads no clock: a stamp generated in here would make every
   * consumer's output irreproducible, and callers know their own locale, their
   * own timezone, and whether their output has to be deterministic.
   */
  printedAt?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      data-print-output
      data-therapy-paper={paperTone === "therapy" ? "" : undefined}
      data-print-monochrome={monochrome ? "" : undefined}
      className={cn(className)}
    >
      {children}
      {printedAt === undefined ? null : <p data-print-stamp>{printedAt}</p>}
      {confidential ? <p data-print-confidential>{CONFIDENTIAL_DOCUMENT_FOOTER}</p> : null}
      <footer data-print-provenance>{provenance}</footer>
    </div>
  );
}
