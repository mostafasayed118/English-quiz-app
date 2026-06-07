"use client";

import { motion } from "framer-motion";
import { Check, X, Bookmark, BookmarkCheck, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { Question } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const LETTER_RE = /^([A-Z])\)\s*/;

/** Strip the "A) " prefix from an option so we render the raw text cleanly. */
function stripPrefix(s: string): string {
  return s.replace(LETTER_RE, "").trim();
}

type QuestionCardProps = {
  question: Question;
  /** The option the user selected, if any. */
  userChoice: string | undefined;
  /** "correct" | "incorrect" | undefined (undefined = not yet answered). */
  outcome: "correct" | "incorrect" | undefined;
  onSelect: (option: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  isFirst: boolean;
  isLast: boolean;
  position: { current: number; total: number };
};

/**
 * The single-question display used inside the QuizEngine.
 *
 * State machine for an individual question:
 *   unanswered  → user clicks option → outcome = "correct" | "incorrect"
 *   answered    → feedback panel revealed → Next enabled
 */
export function QuestionCard({
  question,
  userChoice,
  outcome,
  onSelect,
  onNext,
  onPrev,
  isBookmarked,
  onToggleBookmark,
  isFirst,
  isLast,
  position,
}: QuestionCardProps) {
  const isAnswered = outcome !== undefined;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-2xl border shadow-soft overflow-hidden",
        "bg-white/80 border-slate-200/70",
        "dark:bg-slate-900/60 dark:border-slate-800/70",
        "backdrop-blur-sm",
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
            {question.category}
          </span>
          {question.cefr_level && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {question.cefr_level}
            </span>
          )}
          {question.question_type && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {question.question_type}
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Question {position.current} of {position.total}
          </span>
        </div>
        <button
          onClick={onToggleBookmark}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark question"}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isBookmarked
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20",
          )}
        >
          {isBookmarked ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Question body */}
      <div className="px-6 py-6">
        <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 leading-snug">
          {question.question_text}
        </h2>

        <div className="mt-5 grid gap-2.5">
          {question.options.map((option, idx) => {
            const letter = LETTERS[idx];
            // Compare on the raw option string (preserves the "A) " prefix).
            const isChosen = userChoice === option;
            const isCorrect = option === question.correct_answer;
            const displayText = stripPrefix(option);

            // Visual state per option
            let stateClass = "";
            if (isAnswered) {
              if (isCorrect) {
                stateClass =
                  "border-success-500 bg-success-50 dark:bg-success-900/20 text-success-900 dark:text-success-100";
              } else if (isChosen && !isCorrect) {
                stateClass =
                  "border-danger-500 bg-danger-50 dark:bg-danger-900/20 text-danger-900 dark:text-danger-100";
              } else {
                stateClass =
                  "border-slate-200 dark:border-slate-700 opacity-60";
              }
            } else if (isChosen) {
              stateClass =
                "border-primary-500 bg-primary-50 dark:bg-primary-900/20";
            }

            return (
              <motion.button
                key={`${question.id}-${letter}`}
                type="button"
                onClick={() => onSelect(option)}
                disabled={isAnswered}
                whileHover={!isAnswered ? { x: 4 } : undefined}
                whileTap={!isAnswered ? { scale: 0.99 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                  "w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border-2",
                  "transition-colors duration-150",
                  "disabled:cursor-default",
                  !isAnswered &&
                    "hover:border-primary-400 dark:hover:border-primary-500 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                  stateClass ||
                    "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
                )}
                aria-pressed={isChosen}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                    isAnswered && isCorrect
                      ? "bg-success-500 text-white"
                      : isAnswered && isChosen && !isCorrect
                        ? "bg-danger-500 text-white"
                        : isChosen
                          ? "bg-primary-600 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                  )}
                >
                  {isAnswered && isCorrect ? (
                    <Check className="w-4 h-4" />
                  ) : isAnswered && isChosen && !isCorrect ? (
                    <X className="w-4 h-4" />
                  ) : (
                    letter
                  )}
                </span>
                <span className="flex-1 text-sm md:text-base">{displayText}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Feedback panel */}
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "mt-5 rounded-xl border p-4",
              outcome === "correct"
                ? "bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800/40"
                : "bg-danger-50 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800/40",
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {outcome === "correct" ? (
                <Check className="w-4 h-4 text-success-600 dark:text-success-400" />
              ) : (
                <X className="w-4 h-4 text-danger-600 dark:text-danger-400" />
              )}
              <span
                className={cn(
                  "text-sm font-semibold",
                  outcome === "correct"
                    ? "text-success-700 dark:text-success-300"
                    : "text-danger-700 dark:text-danger-300",
                )}
              >
                {outcome === "correct" ? "Correct!" : "Incorrect"}
              </span>
            </div>
            {question.explanation && (
              <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p>{question.explanation}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer / nav */}
      <div className="px-6 py-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onPrev}
          disabled={isFirst}
          aria-label="Previous question"
        >
          ← Previous
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!isAnswered}
          aria-label={isLast ? "Finish quiz" : "Next question"}
        >
          {isLast ? "Finish Quiz" : "Next →"}
        </Button>
      </div>
    </motion.div>
  );
}
