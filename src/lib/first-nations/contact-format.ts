import { onCallTelHref } from "@/lib/on-call/home-modules";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Reuses On Call's dialler rule, so extensions and pager ids are never handed to the phone. */
export function telHref(raw: string): string | undefined {
  return onCallTelHref(raw);
}

export function shareText(name: string, number: string): string {
  return `${name}: ${number}`;
}

const escapeVcard = (value: string) => value.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

export function vcardFor({ name, number }: { name: string; number: string }): string {
  const tel = (onCallTelHref(number) ?? "").replace(/^tel:/, "");
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVcard(name)}`, `TEL;TYPE=WORK:${tel}`, "END:VCARD", ""].join(
    "\r\n",
  );
}

/** "26 Sep 2026" — Intl's en-AU short month writes "Sept", which the design does not use. */
export function formatDayMonthYear(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
