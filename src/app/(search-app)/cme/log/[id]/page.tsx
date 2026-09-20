import type { Metadata } from "next";

import { CmeEntryPage } from "@/components/cme/cme-entry-page";

type CmeEntryRouteProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Entry | CME | PsychSift",
  description: "One recorded activity: its hours, the categories they count toward, and your reflection.",
};

export default async function CmeEntryRoute({ params }: CmeEntryRouteProps) {
  const { id } = await params;
  return <CmeEntryPage entryId={id} />;
}
