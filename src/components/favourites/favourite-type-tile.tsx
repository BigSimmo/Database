import { cn } from "@/components/ui-primitives";
import type { FavouriteItem, FavouriteType } from "@/components/favourites/favourites-view-model";

// One tint per content type, from the same type tokens the category chips use,
// so a Table tile and a Table chip can never disagree.
const tileTone: Record<FavouriteType, string> = {
  Medication: "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  Document: "bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  Table: "bg-[color:var(--type-table-soft)] text-[color:var(--type-table)]",
  "Saved search": "bg-[color:var(--type-search-soft)] text-[color:var(--type-search)]",
  Source: "bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
  Service: "bg-[color:var(--type-service-soft)] text-[color:var(--type-service)]",
  Form: "bg-[color:var(--type-form-soft)] text-[color:var(--type-form)]",
  Differential: "bg-[color:var(--tone-rose-soft)] text-[color:var(--tone-rose)]",
  Therapy: "bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]",
};

export function FavouriteTypeTile({ item, size = "md" }: { item: FavouriteItem; size?: "sm" | "md" | "lg" }) {
  const Icon = item.icon;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center",
        size === "sm" ? "size-6 rounded-md" : size === "lg" ? "size-10 rounded-xl" : "size-9 rounded-lg",
        tileTone[item.type],
      )}
    >
      <Icon
        aria-hidden="true"
        className={size === "sm" ? "size-icon-xs" : size === "lg" ? "size-icon-lg" : "size-icon-md"}
      />
    </span>
  );
}
