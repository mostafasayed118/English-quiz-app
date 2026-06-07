"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ProgressRingProps = {
  /** 0..1 progress. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Hex color or Tailwind class for the foreground ring. */
  color?: string;
  /** Subtitle text below the percentage. */
  label?: string;
  /** Override displayed number (defaults to Math.round(value*100)). */
  displayValue?: string | number;
};

/**
 * SVG ring progress indicator. Animates from previous to new value on change.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 10,
  className,
  color = "stroke-primary-500",
  label,
  displayValue,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn(color)}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {displayValue ?? `${Math.round(clamped * 100)}%`}
        </div>
        {label && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
