export type CompareCatalogItem = {
  id: string;
  title: string;
  snippet?: string;
  tag?: string;
};

export type CompareStarterChip = {
  id: string;
  label: string;
  href: string;
};

export type CompareSlot = {
  id: string | null;
  label: string;
  title: string;
  subtitle?: string;
};
