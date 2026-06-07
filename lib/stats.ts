/**
 * Pure stats computation helpers.
 *
 * These functions are deterministic and side-effect-free. They are used by both
 * the Dashboard and the Results page.
 */
import type { Attempt, CategoryAccuracy, SessionStats } from "./types";

export type AggregateStats = {
  total: number;
  solved: number;
  remaining: number;
  correct: number;
  incorrect: number;
  accuracy: number; // 0..1
  byCategory: CategoryAccuracy[];
};

export function computeAggregate(
  totalQuestions: number,
  attempts: Record<number, Attempt>,
): AggregateStats {
  const solved = Object.keys(attempts).length;
  const correct = Object.values(attempts).filter(
    (a) => a.outcome === "correct",
  ).length;
  const incorrect = solved - correct;
  const accuracy = solved > 0 ? correct / solved : 0;

  // Per-category roll-up
  const byCategoryMap = new Map<string, { total: number; correct: number }>();
  for (const a of Object.values(attempts)) {
    const cur = byCategoryMap.get(a.category) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (a.outcome === "correct") cur.correct += 1;
    byCategoryMap.set(a.category, cur);
  }
  const byCategory: CategoryAccuracy[] = Array.from(
    byCategoryMap.entries(),
  )
    .map(([category, { total, correct }]) => ({
      category,
      total,
      correct,
      accuracy: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    total: totalQuestions,
    solved,
    remaining: Math.max(0, totalQuestions - solved),
    correct,
    incorrect,
    accuracy,
    byCategory,
  };
}

export function computeSession(
  totalAnswered: number,
  correct: number,
  durationSec: number,
  byCategory: { category: string; total: number; correct: number }[],
): SessionStats {
  const incorrect = totalAnswered - correct;
  return {
    totalAnswered,
    correct,
    incorrect,
    accuracy: totalAnswered > 0 ? correct / totalAnswered : 0,
    durationSec,
    categoryAccuracy: byCategory.map((c) => ({
      category: c.category,
      total: c.total,
      correct: c.correct,
      accuracy: c.total > 0 ? c.correct / c.total : 0,
    })),
  };
}
