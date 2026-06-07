"use client";

import { useEffect } from "react";
import { useQuizStore } from "@/lib/store";

/**
 * Top-level client provider. Responsibilities:
 *  - Apply persisted theme to <html> on first mount (after Zustand rehydrates).
 *
 * Persist's onRehydrateStorage fires after the store has loaded from
 * localStorage, so we read the theme there.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme immediately on mount in case the store hasn't been touched
    // yet. This is a no-op if the user later changes the theme.
    const root = document.documentElement;
    const isSystemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const theme = useQuizStore.getState().theme;
    const isDark =
      theme === "dark" || (theme === "system" && isSystemDark);
    root.classList.toggle("dark", isDark);

    // Re-apply if system preference changes and the user is on "system".
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        root.classList.toggle("dark", mq.matches);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  return <>{children}</>;
}
