import { EmptyState, primaryControl } from "@/components/ui-primitives";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[300px] items-center justify-center p-6">
      <EmptyState
        icon={FileQuestion}
        title="Differential Not Found"
        body="The requested differential diagnosis could not be found or may have been deleted."
        actions={
          <Link href="/search" className={primaryControl}>
            Return to search
          </Link>
        }
      />
    </div>
  );
}
