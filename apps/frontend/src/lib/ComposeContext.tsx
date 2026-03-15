"use client";

import { createContext, useContext, useState } from "react";

interface ComposeContextValue {
  composeOpen: boolean;
  openCompose: () => void;
  closeCompose: () => void;
}

const ComposeContext = createContext<ComposeContextValue>({
  composeOpen: false,
  openCompose: () => {},
  closeCompose: () => {},
});

export function ComposeProvider({ children }: { children: React.ReactNode }) {
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <ComposeContext.Provider
      value={{
        composeOpen,
        openCompose: () => setComposeOpen(true),
        closeCompose: () => setComposeOpen(false),
      }}
    >
      {children}
    </ComposeContext.Provider>
  );
}

export function useCompose() {
  return useContext(ComposeContext);
}
