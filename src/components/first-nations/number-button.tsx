"use client";
import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui-primitives";
import { ModeDialSheet, ModeFactTile, type ModeDialNumber } from "@/components/first-nations/kit";
import { telHref } from "@/lib/first-nations/contact-format";
import type { ContactView } from "@/lib/first-nations/view-model";

/** What the kit's dial sheet needs: the number as shown, what to dial (or null) and what to copy. */
export function dialNumber(contact: ContactView): ModeDialNumber {
  return { display: contact.number, tel: telHref(contact.number) ?? null, copy: contact.number };
}

/**
 * The kit's dial sheet for one First Nations contact: the number in large
 * digits, Call, Copy (and Share where the phone has it), and the checked line
 * with its source. The kit sheet has no footer slot, so "Save to phone" and
 * "Report a wrong number" are not in it; the report link lives in the page menu.
 */
function DialSheet({ contact, open, onClose }: { contact: ContactView; open: boolean; onClose: () => void }) {
  return (
    <ModeDialSheet
      open={open}
      onClose={onClose}
      label={contact.name}
      context={contact.detail || null}
      number={dialNumber(contact)}
      source={{ label: contact.source.title, url: contact.source.url }}
      checkedAt={contact.checkedAt}
    />
  );
}

/** A number in running text. Without JavaScript it is a plain tel: link; once hydrated it opens the sheet. */
export function NumberButton({
  contact,
  children,
  className,
}: {
  contact: ContactView;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a
        href={telHref(contact.number)}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        className={cn("nums inline-flex min-h-12 items-center font-normal", className)}
      >
        {children ?? contact.number}
      </a>
      <DialSheet contact={contact} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** A number as a fact tile; the value opens the same sheet. */
export function NumberTile({ contact, label }: { contact: ContactView; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModeFactTile
        label={label}
        value={
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="nums inline-flex min-h-12 items-center text-left font-normal"
          >
            {contact.number}
          </button>
        }
      />
      <DialSheet contact={contact} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
