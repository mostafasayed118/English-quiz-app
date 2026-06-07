/**
 * Zustand store with `persist` middleware → localStorage.
 *
 * Holds all user-side mutable state:
 *  - `attempts`     : Record<questionId, Attempt> — what the user has answered
 *  - `bookmarks`    : Record<questionId, true>   — manually hidden
 *  - `hideSolved`   : global filter toggle
 *  - `selectedCategories` : 'all' | string[]  — sidebar filter
 *  - `theme`        : 'light' | 'dark' | 'system'
 *  - `session`      : current in-progress session (or null)
 *
 * The store is the single source of truth. All components read & write through
 * it; nothing else touches `localStorage` directly.
 */
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Attempt, AttemptOutcome, Question } from "./types";
import { filterQuestions, getAllQuestions, pickRandom } from "./questions";

export type Theme = "light" | "dark" | "system";

export type CategoryFilter = "all" | string[];

export type Session = {
  /** Ordered list of question IDs in this session. */
  questionIds: number[];
  /** Index into `questionIds`. */
  cursor: number;
  /** Map of questionId → chosen option text (for "Previous" navigation). */
  userChoices: Record<number, string>;
  /** Map of questionId → outcome, populated as user answers. */
  sessionOutcomes: Record<number, AttemptOutcome>;
  /** Started-at timestamp (ms). */
  startedAt: number;
};

export type QuizStore = {
  // --- Persisted state ---
  attempts: Record<number, Attempt>;
  bookmarks: Record<number, true>;
  hideSolved: boolean;
  selectedCategories: CategoryFilter;
  theme: Theme;
  lastSessionResults: null | {
    totalAnswered: number;
    correct: number;
    durationSec: number;
    categoryBreakdown: { category: string; total: number; correct: number }[];
  };

  // --- Ephemeral state (not persisted) ---
  session: Session | null;

  // --- Actions ---
  recordAnswer: (
    question: Question,
    chosen: string,
    outcome: AttemptOutcome,
  ) => void;
  toggleBookmark: (questionId: number) => void;
  setHideSolved: (v: boolean) => void;
  setSelectedCategories: (c: CategoryFilter) => void;
  setTheme: (t: Theme) => void;
  resetProgress: () => void;

  startSession: (size: number) => void;
  endSession: () => void;
  setSessionChoice: (questionId: number, choice: string) => void;
  setSessionOutcome: (questionId: number, outcome: AttemptOutcome) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  jumpTo: (idx: number) => void;
};

export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      // ---- persisted defaults ----
      attempts: {},
      bookmarks: {},
      hideSolved: false,
      selectedCategories: "all",
      theme: "system",
      lastSessionResults: null,

      // ---- ephemeral ----
      session: null,

      // ---- actions ----
      recordAnswer: (question, chosen, outcome) => {
        const now = new Date().toISOString();
        set((state) => {
          const prev = state.attempts[question.id];
          // Only count the *last* attempt toward the persisted outcome.
          // If the user flips correct → incorrect, the new outcome wins.
          const next: Attempt = {
            questionId: question.id,
            category: question.category,
            outcome,
            lastAnsweredAt: now,
            timesAttempted: (prev?.timesAttempted ?? 0) + 1,
          };
          return {
            attempts: { ...state.attempts, [question.id]: next },
            // Track this attempt's choice + outcome inside the active session
            session: state.session
              ? {
                  ...state.session,
                  userChoices: {
                    ...state.session.userChoices,
                    [question.id]: chosen,
                  },
                  sessionOutcomes: {
                    ...state.session.sessionOutcomes,
                    [question.id]: outcome,
                  },
                }
              : state.session,
          };
        });
      },

      toggleBookmark: (questionId) => {
        set((state) => {
          const next = { ...state.bookmarks };
          if (next[questionId]) delete next[questionId];
          else next[questionId] = true;
          return { bookmarks: next };
        });
      },

      setHideSolved: (v) => set({ hideSolved: v }),
      setSelectedCategories: (c) => set({ selectedCategories: c }),
      setTheme: (t) => set({ theme: t }),

      resetProgress: () => {
        set({
          attempts: {},
          bookmarks: {},
          hideSolved: false,
          selectedCategories: "all",
          session: null,
        });
      },

      startSession: (size) => {
        const { selectedCategories, hideSolved, attempts, bookmarks } = get();
        const pool = filterQuestions(
          selectedCategories,
          hideSolved,
          attempts,
          bookmarks,
        );
        if (pool.length === 0) {
          // Nothing to quiz on — let the UI handle this empty state.
          set({ session: null });
          return;
        }
        const picked = pickRandom(pool, size);
        set({
          session: {
            questionIds: picked.map((q) => q.id),
            cursor: 0,
            userChoices: {},
            sessionOutcomes: {},
            startedAt: Date.now(),
          },
        });
      },

      endSession: () => {
        const { session, lastSessionResults } = get();
        if (!session) return;
        const totalAnswered = Object.keys(session.sessionOutcomes).length;
        const correct = Object.values(session.sessionOutcomes).filter(
          (o) => o === "correct",
        ).length;
        const durationSec = Math.round((Date.now() - session.startedAt) / 1000);

        // Per-category breakdown for this session
        const catMap = new Map<string, { total: number; correct: number }>();
        for (const qid of session.questionIds) {
          const outcome = session.sessionOutcomes[qid];
          if (!outcome) continue;
          const q = getAllQuestions().find((x) => x.id === qid);
          if (!q) continue;
          const cur = catMap.get(q.category) ?? { total: 0, correct: 0 };
          cur.total += 1;
          if (outcome === "correct") cur.correct += 1;
          catMap.set(q.category, cur);
        }

        set({
          session: null,
          // Only persist the last "completed" session result for the Results
          // page. The most recent session is what the user just finished.
          lastSessionResults: {
            totalAnswered,
            correct,
            durationSec,
            categoryBreakdown: Array.from(catMap.entries()).map(
              ([category, v]) => ({ category, ...v }),
            ),
          },
        });
      },

      setSessionChoice: (questionId, choice) => {
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  userChoices: {
                    ...state.session.userChoices,
                    [questionId]: choice,
                  },
                },
              }
            : {},
        );
      },

      setSessionOutcome: (questionId, outcome) => {
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  sessionOutcomes: {
                    ...state.session.sessionOutcomes,
                    [questionId]: outcome,
                  },
                },
              }
            : {},
        );
      },

      nextQuestion: () => {
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  cursor: Math.min(
                    state.session.cursor + 1,
                    state.session.questionIds.length - 1,
                  ),
                },
              }
            : {},
        );
      },

      prevQuestion: () => {
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  cursor: Math.max(0, state.session.cursor - 1),
                },
              }
            : {},
        );
      },

      jumpTo: (idx) => {
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  cursor: Math.max(
                    0,
                    Math.min(idx, state.session.questionIds.length - 1),
                  ),
                },
              }
            : {},
        );
      },
    }),
    {
      name: "english-quiz-store-v1",
      storage: createJSONStorage(() => localStorage),
      // Only persist what we want to keep across reloads; `session` is
      // intentionally excluded so closing the tab mid-quiz does not corrupt
      // the dashboard counters.
      partialize: (state) => ({
        attempts: state.attempts,
        bookmarks: state.bookmarks,
        hideSolved: state.hideSolved,
        selectedCategories: state.selectedCategories,
        theme: state.theme,
        lastSessionResults: state.lastSessionResults,
      }),
      version: 1,
    },
  ),
);

/**
 * Helper hook that returns the current visible pool of questions (full filter
 * pipeline applied) plus its length. Used by Dashboard & QuizStart.
 */
export function useVisibleQuestionCount(): number {
  const { selectedCategories, hideSolved, attempts, bookmarks } = useQuizStore();
  return filterQuestions(
    selectedCategories,
    hideSolved,
    attempts,
    bookmarks,
  ).length;
}
