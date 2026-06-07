"use client";

import { useEffect, useState } from "react";

/**
 * Tracks when the Zustand persist middleware has finished hydrating from
 * localStorage. Components that depend on persisted state should not render
 * their "real" UI until this hook returns `true` — otherwise they'll flash
 * the default (empty) state on every page load.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
