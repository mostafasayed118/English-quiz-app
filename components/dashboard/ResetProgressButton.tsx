"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useQuizStore } from "@/lib/store";

/**
 * "Reset progress" button with two-step confirmation. First click reveals the
 * confirmation modal; second click wipes attempts/bookmarks from the persisted
 * Zustand store.
 */
export function ResetProgressButton() {
  const [open, setOpen] = useState(false);
  const resetProgress = useQuizStore((s) => s.resetProgress);
  const attemptCount = useQuizStore(
    (s) => Object.keys(s.attempts).length,
  );

  const handleReset = () => {
    resetProgress();
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={attemptCount === 0}
        className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 border-danger-200 dark:border-danger-800/60 dark:hover:bg-danger-900/30 dark:text-danger-400"
      >
        <Trash2 className="w-4 h-4" />
        Reset Progress
        {attemptCount > 0 && (
          <span className="ml-1 text-xs opacity-70">({attemptCount})</span>
        )}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset all progress?"
        description="This will permanently delete your solved questions, bookmarks, and session results. This action cannot be undone."
      >
        <div className="flex items-start gap-3 p-3 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/60">
          <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400 shrink-0 mt-0.5" />
          <div className="text-sm text-danger-900 dark:text-danger-200">
            <p className="font-semibold">You&apos;re about to delete:</p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-danger-800/90 dark:text-danger-300/90">
              <li>{attemptCount} recorded attempts</li>
              <li>All bookmarks</li>
              <li>Filter and theme preferences</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReset}>
            <Trash2 className="w-4 h-4" />
            Yes, reset everything
          </Button>
        </div>
      </Modal>
    </>
  );
}
