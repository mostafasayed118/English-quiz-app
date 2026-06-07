/**
 * `cn` — small className concatenator. Filters out falsy values and joins with spaces.
 * Used throughout components to conditionally apply Tailwind classes.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format seconds as `mm:ss`. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Format a 0..1 ratio as a "xx%" string with no decimals. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "0%";
  return `${Math.round(ratio * 100)}%`;
}

/** Stable, sorted array of unique categories from a question list. */
export function uniqueCategories<T extends { category: string }>(
  items: T[],
): string[] {
  const set = new Set<string>();
  for (const item of items) set.add(item.category);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
