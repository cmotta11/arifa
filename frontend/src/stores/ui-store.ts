import { create } from "zustand";
import { persist } from "zustand/middleware";

type Language = "en" | "es";

interface UIState {
  sidebarCollapsed: boolean;
  language: Language;
  toggleSidebar: () => void;
  setLanguage: (language: Language) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      language: "es",

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setLanguage: (language) => {
        set({ language });
      },
    }),
    {
      name: "arifa-ui-preferences",
    },
  ),
);
