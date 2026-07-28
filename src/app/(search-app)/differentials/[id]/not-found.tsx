"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui-primitives";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <EmptyState
        icon={FileQuestion}
        title="Differential Not Found"
        body="The requested differential diagnosis could not be found or has been deleted."
        action={
          <Link href="/differentials" className="text-sm font-medium text-blue-600 hover:underline">
            Return to differentials
          </Link>
        }
      />
    </div>
  );
}
