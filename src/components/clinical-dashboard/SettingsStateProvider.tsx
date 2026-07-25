import * as React from "react";
import { useSidebarCollapsed } from "@/lib/hooks";
import { DocumentDrawerMode, UploadIndexingTab } from "@/lib/types";

type SettingsStateContextType = {
  guideOpen: boolean;
  setGuideOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  documentsDrawerOpen: boolean;
  setDocumentsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentScopeOpen: boolean;
  setDocumentScopeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentsDrawerMode: DocumentDrawerMode;
  setDocumentsDrawerMode: React.Dispatch<React.SetStateAction<DocumentDrawerMode>>;
  uploadDrawerOpen: boolean;
  setUploadDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  uploadMobileTab: UploadIndexingTab;
  setUploadMobileTab: React.Dispatch<React.SetStateAction<UploadIndexingTab>>;
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
  const [uploadDrawerOpen, setUploadDrawerOpen] = React.useState(false);
  const [uploadMobileTab, setUploadMobileTab] = React.useState<UploadIndexingTab>("upload");

  return (
    <SettingsStateContext.Provider
      value={{
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
        uploadDrawerOpen,
        setUploadDrawerOpen,
        uploadMobileTab,
        setUploadMobileTab,
      }}
    >
      {children}
    </SettingsStateContext.Provider>
  );
}

export function useSettingsState() {
  const context = React.useContext(SettingsStateContext);
  if (!context) {
    throw new Error("useSettingsState must be used within SettingsStateProvider");
  }
  return context;
}
