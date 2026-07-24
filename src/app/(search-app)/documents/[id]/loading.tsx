import { DocumentViewerPageSkeleton } from "@/components/mode-home-page-skeleton";

export default function Loading() {
  return (
    <div className="bg-[color:var(--background)]">
      <DocumentViewerPageSkeleton />
    </div>
  );
}
