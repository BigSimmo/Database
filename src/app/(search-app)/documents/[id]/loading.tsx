import { DocumentViewerPageSkeleton } from "@/components/mode-home-page-skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col bg-[color:var(--background)]">
      <DocumentViewerPageSkeleton />
    </div>
  );
}
