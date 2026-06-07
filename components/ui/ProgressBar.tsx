"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number; // 0..1
  className?: string;
  color?: string;
  showLabel?: boolean;
};

/** Linear horizontal progress bar with smooth animation. */
export function ProgressBar({
  value,
  className,
  color = "bg-primary-500",
  showLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("w-full", className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-right">
          {Math.round(clamped * 100)}%
        </div>
      )}
    </div>
  );
}
