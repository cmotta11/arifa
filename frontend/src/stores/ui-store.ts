import { create } from "zustand";
import { persist } from "zustand/middleware";

type Language = "en" | "es";

interface UIState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  language: Language;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setLanguage: (language: Language) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      language: "es",

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setMobileSidebarOpen: (open) => {
        set({ mobileSidebarOpen: open });
      },

      setLanguage: (language) => {
        set({ language });
      },
    }),
    {
      name: "arifa-ui-preferences",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        language: state.language,
      }),
    },
  ),
);
