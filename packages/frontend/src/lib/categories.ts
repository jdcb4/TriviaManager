/**
 * Predefined trivia category list (Trivial Pursuit-inspired).
 * Keep this list in sync with the backend constant in services/categories.ts.
 */
export const CATEGORIES = [
  'Arts & Literature',
  'Entertainment',
  'Food & Drink',
  'General Knowledge',
  'Geography',
  'History',
  'Music',
  'Science & Nature',
  'Sports & Leisure',
  'Technology',
] as const

export type Category = (typeof CATEGORIES)[number]
