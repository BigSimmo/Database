import * as React from "react";

type OverlayContextType = {
  activeOverlays: Set<string>;
  registerOverlay: (id: string) => void;
  unregisterOverlay: (id: string) => void;
  isTopOverlay: (id: string) => boolean;
};

const OverlayContext = React.createContext<OverlayContextType | null>(null);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [activeOverlays, setActiveOverlays] = React.useState<Set<string>>(new Set());

  const registerOverlay = React.useCallback((id: string) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unregisterOverlay = React.useCallback((id: string) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isTopOverlay = React.useCallback(
    (id: string) => {
      const activeArray = Array.from(activeOverlays);
      return activeArray[activeArray.length - 1] === id;
    },
    [activeOverlays],
  );

  const value = React.useMemo(
    () => ({ activeOverlays, registerOverlay, unregisterOverlay, isTopOverlay }),
    [activeOverlays, registerOverlay, unregisterOverlay, isTopOverlay],
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(id: string) {
  const context = React.useContext(OverlayContext);
  if (!context) {
    throw new Error("useOverlay must be used within an OverlayProvider");
  }

  const { registerOverlay, unregisterOverlay } = context;

  React.useEffect(() => {
    registerOverlay(id);
    return () => unregisterOverlay(id);
  }, [id, registerOverlay, unregisterOverlay]);

  return {
    isTopOverlay: context.isTopOverlay(id),
  };
}
