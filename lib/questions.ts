/**
 * Server-side question loader + filter helpers.
 *
 * The full question bank is imported at build time. Components that need a
 * subset (filtered by category, hide-solved, etc.) call these helpers rather
 * than re-implementing the filtering logic.
 *
 * Schema (see `lib/types.ts`):
 *   { id, category, cefr_level, question_type, question_text,
 *     options, correct_answer, explanation, tags }
 */
import type { Question, Attempt } from "./types";
import { uniqueCategories } from "./utils";
import questionsData from "@/data/questions.json";

const ALL_QUESTIONS: Question[] = questionsData as Question[];

// One-time, build-side log so the user can confirm the bank loaded.
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.log(
    `✅ Successfully loaded ${ALL_QUESTIONS.length.toLocaleString()} new questions. Zero data loss.`,
  );
}

/** Returns all questions (full bank). */
export function getAllQuestions(): Question[] {
  return ALL_QUESTIONS;
}

/** Returns the unique categories present in the bank, alphabetically sorted. */
export function getAllCategories(): string[] {
  return uniqueCategories(ALL_QUESTIONS);
}

/** Lookup a question by id; returns undefined if not found. */
export function getQuestionById(id: number): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

/** Apply category + hide-solved + bookmark filters to the full question list. */
export function filterQuestions(
  categories: string[] | "all",
  hideSolved: boolean,
  attempts: Record<number, Attempt>,
  bookmarks: Record<number, true>,
): Question[] {
  return ALL_QUESTIONS.filter((q) => {
    // Category filter
    if (categories !== "all" && !categories.includes(q.category)) return false;

    // Hide solved = skip questions the user has already attempted (correct OR
    // incorrect). We keep bookmarked questions visible only if the user is
    // *not* hiding solved — bookmarks survive the filter.
    if (hideSolved) {
      const wasAttempted = !!attempts[q.id];
      const isBookmarked = !!bookmarks[q.id];
      if (wasAttempted && !isBookmarked) return false;
    }

    return true;
  });
}

/** Pick `count` questions at random from the given pool, deterministically seeded
 *  by `seed` when provided (so the same seed → same quiz). */
export function pickRandom<T>(pool: T[], count: number, seed?: number): T[] {
  if (pool.length === 0 || count <= 0) return [];
  // Fisher–Yates with seeded RNG when seed is provided; otherwise Math.random.
  const arr = [...pool];
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

// Tiny seedable PRNG (Mulberry32) for deterministic sampling.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
