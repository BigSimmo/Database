import { redirect } from "next/navigation";

/** Keep existing bookmarks while Set up owns both the read view and editor. */
export default async function CmeProgrammeRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const query = await searchParams;
  const requestedYear = query.year ? Number(query.year) : undefined;
  const year =
    Number.isInteger(requestedYear) && requestedYear! >= 2000 && requestedYear! <= 2100 ? requestedYear : null;
  redirect(year ? `/cme/setup?year=${year}` : "/cme/setup");
}
