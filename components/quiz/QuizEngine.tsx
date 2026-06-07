"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Play, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuestionCard } from "./QuestionCard";
import { useQuizStore } from "@/lib/store";
import {
  filterQuestions,
  getAllQuestions,
  getQuestionById,
} from "@/lib/questions";
import { useHasMounted } from "@/lib/hooks";

/**
 * The orchestrator. Either shows the "start" picker (no session yet) or the
 * active session (one question at a time).
 *
 * Auto-finishes the session when the user clicks "Next" on the last question.
 */
export function QuizEngine() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSize = Number(searchParams.get("size") ?? 10);

  const session = useQuizStore((s) => s.session);
  const startSession = useQuizStore((s) => s.startSession);
  const endSession = useQuizStore((s) => s.endSession);
  const recordAnswer = useQuizStore((s) => s.recordAnswer);
  const toggleBookmark = useQuizStore((s) => s.toggleBookmark);
  const bookmarks = useQuizStore((s) => s.bookmarks);
  const attempts = useQuizStore((s) => s.attempts);
  const selectedCategories = useQuizStore((s) => s.selectedCategories);
  const hideSolved = useQuizStore((s) => s.hideSolved);
  const setSessionChoice = useQuizStore((s) => s.setSessionChoice);
  const setSessionOutcome = useQuizStore((s) => s.setSessionOutcome);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const prevQuestion = useQuizStore((s) => s.prevQuestion);

  const [selectedSize, setSelectedSize] = useState(
    [10, 25, 50].includes(requestedSize) ? requestedSize : 10,
  );
  const hasMounted = useHasMounted();

  // Compute pool size for the "start" screen. Subscribes to filter state so
  // the pool re-derives whenever the user toggles a category on the
  // dashboard and then navigates to /quiz.
  const pool = useMemo(() => {
    if (!hasMounted) return [];
    return filterQuestions(selectedCategories, hideSolved, attempts, bookmarks);
  }, [hasMounted, selectedCategories, hideSolved, attempts, bookmarks]);

  // Resolve current question
  const currentQ =
    session && hasMounted
      ? getQuestionById(session.questionIds[session.cursor])
      : null;

  const userChoice = session?.userChoices[currentQ?.id ?? -1];
  const sessionOutcome = session?.sessionOutcomes[currentQ?.id ?? -1];

  // When the user clicks "Next" on the last question, end the session.
  // We do this by watching the cursor; once it advances past the last index
  // we finalize.
  useEffect(() => {
    if (!session) return;
    if (
      session.cursor === session.questionIds.length - 1 &&
      // and the last question has been answered
      session.sessionOutcomes[session.questionIds[session.cursor]] &&
      // route to analytics automatically (caller can disable by Next'ing manually
      // — but for this product, finishing always redirects)
      // we just trigger once: set a transient flag
      false
    ) {
      // intentionally a no-op; see onNext handler below
    }
  }, [session]);

  if (!hasMounted) {
    return <QuizSkeleton />;
  }

  // ====== Start screen ======
  if (!session || !currentQ) {
    const poolSize = pool.length;
    const total = getAllQuestions().length;
    const canStart = poolSize > 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Start a new quiz
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {canStart
                    ? `Pick a size. We'll randomly select from ${poolSize.toLocaleString()} question${poolSize === 1 ? "" : "s"} matching your current filters.`
                    : "No questions match your current filters. Adjust them on the dashboard."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[10, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedSize(n)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    selectedSize === n
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-500"
                  }`}
                >
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {n}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    questions
                  </div>
                  {selectedSize === n && (
                    <motion.div
                      layoutId="size-indicator"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
                    >
                      ✓
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5">
                <span>Pool size</span>
                <span className="font-semibold">
                  {poolSize.toLocaleString()} / {total.toLocaleString()}
                </span>
              </div>
              <ProgressBar
                value={total > 0 ? poolSize / total : 0}
                color="bg-primary-500"
              />
            </div>

            <div className="mt-6 flex gap-2">
              <Link href="/" className="flex-1">
                <Button variant="ghost" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button
                className="flex-1"
                onClick={() => startSession(selectedSize)}
                disabled={!canStart}
              >
                <Play className="w-4 h-4" />
                Start Quiz
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Best practices card */}
        <Card>
          <CardBody className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold mb-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              How it works
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>Pick an answer — you&apos;ll get instant feedback with an explanation.</li>
              <li>Use <strong>Next</strong> / <strong>Previous</strong> to navigate freely.</li>
              <li>Bookmark a question to keep it visible when &quot;Hide solved&quot; is on.</li>
              <li>Your progress is auto-saved. Close the tab and come back anytime.</li>
            </ul>
          </CardBody>
        </Card>
      </motion.div>
    );
  }

  // ====== Active session ======
  const total = session.questionIds.length;
  const cursor = session.cursor;
  const isFirst = cursor === 0;
  const isLast = cursor === total - 1;
  const isBookmarked = !!bookmarks[currentQ.id];
  const answeredCount = Object.keys(session.sessionOutcomes).length;
  const progress = (cursor + (sessionOutcome ? 1 : 0)) / total;

  const onSelect = (option: string) => {
    if (sessionOutcome) return; // already answered, locked
    const isCorrect = option === currentQ.correct_answer;
    setSessionChoice(currentQ.id, option);
    setSessionOutcome(currentQ.id, isCorrect ? "correct" : "incorrect");
    recordAnswer(currentQ, option, isCorrect ? "correct" : "incorrect");
  };

  const onNext = () => {
    if (isLast) {
      endSession();
      router.push("/analytics");
      return;
    }
    nextQuestion();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top stats bar */}
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> Exit
        </Link>
        <div className="font-mono text-xs">
          {answeredCount}/{total} answered
        </div>
      </div>

      <ProgressBar value={progress} color="bg-primary-500" />

      <AnimatePresence mode="wait">
        <QuestionCard
          key={currentQ.id}
          question={currentQ}
          userChoice={userChoice}
          outcome={sessionOutcome}
          onSelect={onSelect}
          onNext={onNext}
          onPrev={prevQuestion}
          isBookmarked={isBookmarked}
          onToggleBookmark={() => toggleBookmark(currentQ.id)}
          isFirst={isFirst}
          isLast={isLast}
          position={{ current: cursor + 1, total }}
        />
      </AnimatePresence>
    </div>
  );
}

function QuizSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
      <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
      <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800/40 animate-pulse" />
    </div>
  );
}
