import { create } from "zustand";

interface AppState {
  selectedThreadId: string | null;
  setSelectedThread: (id: string | null) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  syncInProgress: boolean;
  setSyncInProgress: (syncing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedThreadId: null,
  setSelectedThread: (id) => set({ selectedThreadId: id }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  syncInProgress: false,
  setSyncInProgress: (syncing) => set({ syncInProgress: syncing }),
}));
