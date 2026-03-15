/**
 * Predefined trivia category list (Trivial Pursuit-inspired).
 * Keep this list in sync with the backend constant in services/categories.ts.
 */
export const CATEGORIES = [
  'Science & Nature',
  'History',
  'Geography',
  'Entertainment',
  'Sports & Leisure',
  'Arts & Literature',
  'Food & Drink',
  'Technology',
  'Music',
  'General Knowledge',
] as const

export type Category = (typeof CATEGORIES)[number]
