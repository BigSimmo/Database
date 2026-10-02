"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Hands the month to the browser's print dialog; the print styles do the rest. */
export function PrintButton() {
  return (
    <Button className="min-h-12" icon={Printer} data-print-hide onClick={() => window.print()}>
      Print
    </Button>
  );
}
