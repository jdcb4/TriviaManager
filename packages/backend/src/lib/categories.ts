/**
 * Predefined trivia category list. Keep in sync with packages/frontend/src/lib/categories.ts.
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

export const VALID_CATEGORY_SET = new Set<string>(CATEGORIES)

/** Return the category if valid, otherwise fall back to 'General Knowledge'. */
export function normalizeCategory(category: string | null | undefined): string {
  if (category && VALID_CATEGORY_SET.has(category)) return category
  return 'General Knowledge'
}
