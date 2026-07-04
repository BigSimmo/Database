"use client";

import { createContext, useContext } from "react";

import type { AppModeId } from "@/lib/app-modes";

export type SearchCommandContextValue = {
  query: string;
  modeId: AppModeId;
  commandScopes: string[];
  onRemoveScope: (scopeId: string) => void;
  onClearScopes: () => void;
};

const SearchCommandContext = createContext<SearchCommandContextValue | null>(null);

export function SearchCommandProvider({
  value,
  children,
}: {
  value: SearchCommandContextValue;
  children: React.ReactNode;
}) {
  return <SearchCommandContext.Provider value={value}>{children}</SearchCommandContext.Provider>;
}

export function useSearchCommand() {
  return useContext(SearchCommandContext);
}
