"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Role, WorkspaceType } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import { getActiveWorkspaceId, setStoredWorkspaceId } from "@/lib/workspace";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  logoUrl: string | null;
  roles: Role[];
}

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceSummary | null;
  roles: Role[];
  isSuperAdmin: boolean;
  setActiveWorkspace: (id: string) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = trpc.auth.me.useQuery();
  const [activeWorkspaceId, setActiveId] = useState<string | null>(null);

  const workspaces = useMemo<WorkspaceSummary[]>(() => {
    if (!data) return [];
    const byId = new Map<string, WorkspaceSummary>();
    for (const m of data.memberships) {
      const existing = byId.get(m.workspaceId);
      if (existing) {
        existing.roles.push(m.role);
      } else {
        byId.set(m.workspaceId, {
          id: m.workspaceId,
          name: m.workspace.name,
          slug: m.workspace.slug,
          type: m.workspace.type,
          logoUrl: m.workspace.logoUrl,
          roles: [m.role],
        });
      }
    }
    return Array.from(byId.values());
  }, [data]);

  useEffect(() => {
    if (workspaces.length === 0) return;
    const stored = getActiveWorkspaceId();
    const isValid = stored && workspaces.some((w) => w.id === stored);
    if (isValid) {
      setActiveId(stored);
      return;
    }
    const primary =
      data?.memberships.find((m) => m.isPrimary)?.workspaceId ?? workspaces[0]?.id;
    if (primary) {
      setStoredWorkspaceId(primary);
      setActiveId(primary);
    }
  }, [workspaces, data]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  function setActiveWorkspace(id: string) {
    setStoredWorkspaceId(id);
    setActiveId(id);
    void queryClient.invalidateQueries();
  }

  const value: WorkspaceContextValue = {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    roles: activeWorkspace?.roles ?? [],
    isSuperAdmin: data?.isSuperAdmin ?? false,
    setActiveWorkspace,
    isLoading,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
