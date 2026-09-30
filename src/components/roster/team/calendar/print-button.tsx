"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Hands the month to the browser's print dialog; the print styles do the rest. */
export function PrintButton() {
  return (
    <Button className="min-h-12" data-print-hide onClick={() => window.print()}>
      <Printer aria-hidden="true" className="size-icon-md shrink-0" />
      Print
    </Button>
  );
}
