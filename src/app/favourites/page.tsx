import { FavouritesHomePage } from "@/components/clinical-dashboard/favourites-home-page";

type FavouritesPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FavouritesPage({ searchParams }: FavouritesPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.q)?.trim() ?? "";

  return <FavouritesHomePage query={query} />;
}
