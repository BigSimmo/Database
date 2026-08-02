import { DocumentSearchPageSkeleton } from "@/components/mode-home-page-skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] bg-[color:var(--background)]">
      <DocumentSearchPageSkeleton />
    </div>
  );
}
