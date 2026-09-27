"use client";
import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui-primitives";
import { ModeDialSheet, ModeFactTile } from "@/components/first-nations/kit";
import { dialNumber, telHref, vcardFor } from "@/lib/first-nations/contact-format";
import { ContactReviewLine } from "@/components/first-nations/review-line";
import type { ContactView } from "@/lib/first-nations/view-model";

/** Only public team details leave the app, after an explicit action. */
export function ContactActions({ contact }: { contact: ContactView }) {
  const dialable = Boolean(telHref(contact.number));
  return (
    <div className="grid gap-2">
      <ContactReviewLine checkedAt={contact.checkedAt} />
      {dialable ? (
        <a
          className="inline-flex min-h-12 items-center text-sm-minus underline"
          href={`data:text/vcard;charset=utf-8,${encodeURIComponent(vcardFor(contact))}`}
          download={`${contact.id}.vcf`}
        >
          Save to phone
        </a>
      ) : null}
      {contact.reportHref ? (
        <>
          <a className="inline-flex min-h-12 items-center text-sm-minus underline" href={contact.reportHref}>
            Report a wrong number
          </a>
          <p className="text-2xs text-[color:var(--text-muted)]">
            Opens your email app. Include public contact corrections only, never patient or staff personal details.
            PsychSift stores no report.
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Every First Nations number uses the shared dial sheet. */
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
      footer={<ContactActions contact={contact} />}
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
