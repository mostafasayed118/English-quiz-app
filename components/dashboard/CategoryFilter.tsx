"use client";

import { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuizStore } from "@/lib/store";
import { getAllCategories } from "@/lib/questions";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Sidebar / collapsible panel that lets the user:
 *  - Toggle "Hide Solved" globally
 *  - Filter by one or more categories
 *  - Reset the filter back to "All"
 */
export function CategoryFilter() {
  const selected = useQuizStore((s) => s.selectedCategories);
  const setSelected = useQuizStore((s) => s.setSelectedCategories);
  const hideSolved = useQuizStore((s) => s.hideSolved);
  const setHideSolved = useQuizStore((s) => s.setHideSolved);

  const [open, setOpen] = useState(true);
  const categories = getAllCategories();

  const isAll = selected === "all";
  const activeCount = isAll ? categories.length : selected.length;

  // Multi-select: clicking a category toggles it in/out of the active set.
  // The "All" button (separate, below) is the only way to reset to "all".
  const toggleCategory = (cat: string) => {
    const current = selected === "all" ? [] : selected;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setSelected(next.length === 0 ? "all" : next);
  };

  const reset = () => {
    setSelected("all");
    setHideSolved(false);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-soft overflow-hidden",
        "bg-white/80 border-slate-200/70",
        "dark:bg-slate-900/60 dark:border-slate-800/70",
        "backdrop-blur-sm",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Filters
          </span>
          {!isAll && (
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              {activeCount}
            </span>
          )}
          {hideSolved && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Hidden
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-slate-200/60 dark:border-slate-800/60 pt-4">
              {/* Hide solved */}
              <Toggle
                checked={hideSolved}
                onChange={setHideSolved}
                label="Hide solved questions"
                description="Skip questions you've already attempted."
              />

              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Categories
                  </h4>
                  <button
                    onClick={reset}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelected("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                      isAll
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-primary-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:border-primary-500",
                    )}
                  >
                    All
                  </button>
                  {categories.map((cat) => {
                    const active =
                      !isAll && selected.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                          active
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-primary-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:border-primary-500",
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
