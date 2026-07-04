import { ClipboardList, FileText, Folder, LayoutList, Pill, Quote, Search, Stethoscope } from "lucide-react";

export type FavouriteType = "medications" | "documents" | "sources" | "services" | "forms" | "sets";
export type FavouriteTabId = "all" | FavouriteType;

export type FavouriteItem = {
  id: string;
  title: string;
  type: Exclude<FavouriteType, "sets">;
  set: string;
  meta: string;
  sourceMeta: string;
  primaryAction: string;
  href: string;
  icon: typeof FileText;
  keywords: string;
};

export type FavouriteSet = {
  id: string;
  title: string;
  count: number;
  meta: string;
  keywords: string;
};

export const favouriteTabs: Array<{
  id: FavouriteTabId;
  label: string;
  shortLabel: string;
  icon: typeof FileText;
}> = [
  { id: "all", label: "All", shortLabel: "All", icon: LayoutList },
  { id: "medications", label: "Medications", shortLabel: "Meds", icon: Pill },
  { id: "documents", label: "Documents", shortLabel: "Docs", icon: FileText },
  { id: "sources", label: "Sources", shortLabel: "Sources", icon: Quote },
  { id: "services", label: "Services", shortLabel: "Services", icon: Stethoscope },
  { id: "forms", label: "Forms", shortLabel: "Forms", icon: ClipboardList },
  { id: "sets", label: "Sets", shortLabel: "Sets", icon: Folder },
];

export const favouriteItems: FavouriteItem[] = [
  {
    id: "acamprosate-renal-screen",
    title: "Acamprosate renal screen",
    type: "medications",
    set: "Ward round",
    meta: "Medication page · renal cautions · dose notes",
    sourceMeta: "3 sources",
    primaryAction: "Open",
    href: "/medications/acamprosate",
    icon: Pill,
    keywords: "acamprosate renal screen medication dose safety ward round pbs",
  },
  {
    id: "lithium-monitoring-guideline",
    title: "Lithium monitoring guideline",
    type: "documents",
    set: "Prescribing safety",
    meta: "PDF · p.4-9 · 2 tables",
    sourceMeta: "PDF",
    primaryAction: "Ask",
    href: "/?mode=documents&q=lithium+monitoring&run=1",
    icon: FileText,
    keywords: "lithium monitoring guideline blood tests shared care renal toxicity",
  },
  {
    id: "clozapine-monitoring-table",
    title: "Clozapine monitoring table",
    type: "sources",
    set: "Clozapine clinic",
    meta: "Saved table · ANC monitoring",
    sourceMeta: "Table",
    primaryAction: "Source",
    href: "/?mode=documents&q=clozapine+monitoring+table&run=1",
    icon: Quote,
    keywords: "clozapine monitoring table anc fbc neutrophil clinic",
  },
  {
    id: "renal-dose-search",
    title: "renal dose saved search",
    type: "sources",
    set: "Ward round",
    meta: "Saved query · medicines + documents",
    sourceMeta: "Run",
    primaryAction: "Run",
    href: "/?mode=answer&q=renal+dose&run=1",
    icon: Search,
    keywords: "renal dose saved search kidney egfr medicines documents",
  },
  {
    id: "qt-prolongation-quote",
    title: "QT prolongation quote",
    type: "sources",
    set: "Prescribing safety",
    meta: "Source card · prescribing safety",
    sourceMeta: "Quote",
    primaryAction: "Copy",
    href: "/?mode=documents&q=QT+prolongation&run=1",
    icon: Quote,
    keywords: "qt prolongation quote source card prescribing safety",
  },
];

const countItemsInSet = (title: string) => favouriteItems.filter((item) => item.set === title).length;

export const favouriteSets: FavouriteSet[] = [
  {
    id: "ward-round",
    title: "Ward round",
    count: countItemsInSet("Ward round"),
    meta: "Medication pages, renal checks, forms",
    keywords: "ward round acamprosate lithium renal mht forms",
  },
  {
    id: "prescribing-safety",
    title: "Prescribing safety",
    count: countItemsInSet("Prescribing safety"),
    meta: "Dose limits, pregnancy, renal cautions",
    keywords: "prescribing safety dose pregnancy renal qt interactions",
  },
  {
    id: "clozapine-clinic",
    title: "Clozapine clinic",
    count: countItemsInSet("Clozapine clinic"),
    meta: "Monitoring, ANC table, counselling",
    keywords: "clozapine clinic monitoring anc table counselling",
  },
];

export function favouriteTypeCount(type: FavouriteTabId) {
  if (type === "all") return favouriteItems.length + favouriteSets.length;
  if (type === "sets") return favouriteSets.length;
  return favouriteItems.filter((item) => item.type === type).length;
}

export const favouritePrototypeCount = favouriteItems.length + favouriteSets.length;
