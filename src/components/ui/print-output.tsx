"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui-primitives";

export function BrowserPrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="primary" icon={Printer} onClick={() => window.print()}>
      {label}
    </Button>
  );
}

export function PrintOutput({
  children,
  className,
  provenance,
  paperTone,
}: {
  children: ReactNode;
  className?: string;
  provenance: ReactNode;
  paperTone?: "therapy";
}) {
  return (
    <div data-print-output data-therapy-paper={paperTone === "therapy" ? "" : undefined} className={cn(className)}>
      {children}
      <footer data-print-provenance>{provenance}</footer>
    </div>
  );
}
