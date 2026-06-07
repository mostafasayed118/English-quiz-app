/**
 * Domain types shared across the app.
 *
 * `Question` is the immutable shape of a question loaded from `data/questions.json`.
 * `Attempt` is the user's record of having answered a given question once.
 * `SessionStats` is the per-session aggregate shown on the Results page.
 */

export type Question = {
  id: number;
  category: string;
  cefr_level: string;
  question_type: string;
  question_text: string;
  /** 4 options in the new schema, each prefixed with a letter like "A) ". */
  options: string[];
  correct_answer: string;
  explanation: string;
  tags: string[];
};

export type AttemptOutcome = "correct" | "incorrect";

export type Attempt = {
  questionId: number;
  category: string;
  outcome: AttemptOutcome;
  /** ISO timestamp of the last attempt. */
  lastAnsweredAt: string;
  /** Number of times the user has attempted this question. */
  timesAttempted: number;
};

export type Bookmarks = Record<number, true>;

export type CategoryAccuracy = {
  category: string;
  total: number;
  correct: number;
  accuracy: number; // 0..1
};

export type SessionStats = {
  totalAnswered: number;
  correct: number;
  incorrect: number;
  accuracy: number; // 0..1
  /** Time spent answering, in seconds. */
  durationSec: number;
  categoryAccuracy: CategoryAccuracy[];
};

/**
 * Backwards-compat alias: components/legacy code used the old name `Question`.
 * Some places still reference the older `question` and `correctAnswer` fields
 * via these aliases.
 */
export type LegacyQuestion = {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

/** Normalise a Question into the legacy field shape (used by stats/quiz UIs). */
export function toLegacy(q: Question): LegacyQuestion {
  return {
    id: q.id,
    category: q.category,
    question: q.question_text,
    options: q.options,
    correctAnswer: q.correct_answer,
    explanation: q.explanation,
  };
}
