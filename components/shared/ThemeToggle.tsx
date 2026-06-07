"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useQuizStore, type Theme } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Cycle button: light → dark → system → light.
 * Applies the `dark` class to <html> and persists the preference.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useQuizStore((s) => s.theme);
  const setTheme = useQuizStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Apply theme on change & on initial mount (after hydration).
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const apply = (t: Theme) => {
      const isDark =
        t === "dark" ||
        (t === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  const cycle = () => {
    const order: Theme[] = ["light", "dark", "system"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const icon =
    theme === "light" ? (
      <Sun className="w-4 h-4" />
    ) : theme === "dark" ? (
      <Moon className="w-4 h-4" />
    ) : (
      <span className="text-[10px] font-bold leading-none">AUTO</span>
    );

  const label =
    theme === "light"
      ? "Light mode"
      : theme === "dark"
        ? "Dark mode"
        : "System theme";

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      title={label}
      className={cn(
        "inline-flex items-center justify-center h-9 w-9 rounded-xl",
        "border border-slate-200 bg-white text-slate-700",
        "hover:bg-slate-50 transition-colors",
        "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        className,
      )}
    >
      {icon}
    </button>
  );
}
