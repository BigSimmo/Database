import * as React from "react";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";
import { DocumentDrawerMode } from "./dashboard-contracts";
import { IndexingAdministrationTab } from "./document-admin";

type SettingsStateContextType = {
  guideOpen: boolean;
  setGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (next: boolean) => void;
  documentsDrawerOpen: boolean;
  setDocumentsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentScopeOpen: boolean;
  setDocumentScopeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentsDrawerMode: DocumentDrawerMode;
  setDocumentsDrawerMode: React.Dispatch<React.SetStateAction<DocumentDrawerMode>>;
  indexingAdminDrawerOpen: boolean;
  setIndexingAdminDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  indexingAdminMobileTab: IndexingAdministrationTab;
  setIndexingAdminMobileTab: React.Dispatch<React.SetStateAction<IndexingAdministrationTab>>;
};

const SettingsStateContext = React.createContext<SettingsStateContextType | null>(null);

export function SettingsStateProvider({ children }: { children: React.ReactNode }) {
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [documentsDrawerOpen, setDocumentsDrawerOpen] = React.useState(false);
  const [documentScopeOpen, setDocumentScopeOpen] = React.useState(false);
  const [documentsDrawerMode, setDocumentsDrawerMode] = React.useState<DocumentDrawerMode>("library");
  const [indexingAdminDrawerOpen, setIndexingAdminDrawerOpen] = React.useState(false);
  const [indexingAdminMobileTab, setIndexingAdminMobileTab] = React.useState<IndexingAdministrationTab>("jobs");

  const value = React.useMemo(
    () => ({
      guideOpen,
      setGuideOpen,
      settingsOpen,
      setSettingsOpen,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      sidebarCollapsed,
      setSidebarCollapsed,
      documentsDrawerOpen,
      setDocumentsDrawerOpen,
      documentScopeOpen,
      setDocumentScopeOpen,
      documentsDrawerMode,
      setDocumentsDrawerMode,
      indexingAdminDrawerOpen,
      setIndexingAdminDrawerOpen,
      indexingAdminMobileTab,
      setIndexingAdminMobileTab,
    }),
    [
      guideOpen,
      settingsOpen,
      mobileSidebarOpen,
      sidebarCollapsed,
      documentsDrawerOpen,
      documentScopeOpen,
      documentsDrawerMode,
      indexingAdminDrawerOpen,
      indexingAdminMobileTab,
      setSidebarCollapsed,
    ],
  );

  return <SettingsStateContext.Provider value={value}>{children}</SettingsStateContext.Provider>;
}

export function useSettingsState() {
  const context = React.useContext(SettingsStateContext);
  if (!context) {
    throw new Error("useSettingsState must be used within SettingsStateProvider");
  }
  return context;
}
