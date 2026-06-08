"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  /** Optional color theme. */
  tone?: "primary" | "success" | "danger" | "neutral" | "amber";
  /** Optional helper line below the value. */
  hint?: string;
};

const tones = {
  primary: {
    iconWrap: "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
    value: "text-primary-700 dark:text-primary-300",
  },
  success: {
    iconWrap:
      "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300",
    value: "text-success-700 dark:text-success-300",
  },
  danger: {
    iconWrap: "bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300",
    value: "text-danger-700 dark:text-danger-300",
  },
  amber: {
    iconWrap:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    value: "text-amber-700 dark:text-amber-300",
  },
  neutral: {
    iconWrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    value: "text-slate-900 dark:text-slate-100",
  },
};

export function StatCard({ label, value, icon, tone = "neutral", hint }: StatCardProps) {
  const t = tones[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5",
        "bg-white/80 border-slate-200/70",
        "dark:bg-slate-900/60 dark:border-slate-800/70",
        "backdrop-blur-sm transition-all duration-200",
        "hover:border-slate-300 dark:hover:border-slate-600",
        "hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50",
        "cursor-default",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
            {label}
          </p>
          <p className={cn("mt-2 text-3xl font-bold transition-colors", t.value)}>
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
              {hint}
            </p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5 transition-transform duration-200 group-hover:scale-110", t.iconWrap)}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
