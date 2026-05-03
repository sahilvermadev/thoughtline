"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAgentWorkbench } from "@/lib/agent-workbench";

type WorkbenchValue = ReturnType<typeof useAgentWorkbench>;

const WorkbenchContext = createContext<WorkbenchValue | null>(null);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const workbench = useAgentWorkbench();
  return (
    <WorkbenchContext.Provider value={workbench}>
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbench(): WorkbenchValue {
  const value = useContext(WorkbenchContext);
  if (!value) {
    throw new Error("useWorkbench must be used inside <WorkbenchProvider>");
  }
  return value;
}
