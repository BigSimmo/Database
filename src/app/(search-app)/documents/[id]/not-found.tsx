"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui-primitives";
import { FileQuestion } from "lucide-react";
import { appModeHomeHref } from "@/lib/app-modes";

export default function NotFound() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <EmptyState
        icon={FileQuestion}
        title="Document Not Found"
        body="The requested document could not be found or has been deleted."
        actions={
          <Link href={appModeHomeHref("documents")} className="text-sm font-medium text-blue-600 hover:underline">
            Return to document library
          </Link>
        }
      />
    </div>
  );
}
