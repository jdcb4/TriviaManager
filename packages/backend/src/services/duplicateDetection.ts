import { prisma } from '../lib/prisma.js'
import crypto from 'crypto'

export interface DuplicateMatch {
  id: string
  text: string
  score: number
  layer: 'exact' | 'normalized' | 'jaccard' | 'levenshtein'
}

export interface DuplicatePair {
  aId: string
  aText: string
  bId: string
  bText: string
  score: number
  layer: 'exact' | 'normalized' | 'jaccard' | 'levenshtein'
  resolution: string | null  // null | 'not_duplicate' | 'archive_a' | 'archive_b'
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  return intersection / (a.size + b.size - intersection)
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Single-question duplicate check (used in the per-question /:id/duplicates endpoint)
export async function runDuplicateDetection(
  text: string,
  excludeId?: string
): Promise<DuplicateMatch[]> {
  const normalizedTarget = normalize(text)
  const hashTarget = crypto.createHash('sha256').update(normalizedTarget).digest('hex')
  const targetTokens = new Set(normalizedTarget.split(' ').filter(Boolean))

  const questions = await prisma.question.findMany({
    where: {
      status: { in: ['ACTIVE', 'FLAGGED'] },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true, text: true },
  })

  const results: DuplicateMatch[] = []

  for (const q of questions) {
    const normQ = normalize(q.text)
    const hashQ = crypto.createHash('sha256').update(normQ).digest('hex')

    // Layer 1: exact hash
    if (hashQ === hashTarget) {
      results.push({ id: q.id, text: q.text, score: 1.0, layer: 'exact' })
      continue
    }

    // Layer 2: normalized exact
    if (normQ === normalizedTarget) {
      results.push({ id: q.id, text: q.text, score: 0.99, layer: 'normalized' })
      continue
    }

    // Layer 3: Jaccard (fast token overlap)
    const qTokens = new Set(normQ.split(' ').filter(Boolean))
    const jScore = jaccardSets(targetTokens, qTokens)
    if (jScore >= 0.7) {
      results.push({ id: q.id, text: q.text, score: jScore, layer: 'jaccard' })
      continue
    }

    // Layer 4: Levenshtein — only when Jaccard is in the "suspicious" mid-range (0.4–0.7)
    // and both strings are short enough to make character-level comparison worthwhile
    if (jScore >= 0.4 && text.length < 200 && q.text.length < 200) {
      const maxLen = Math.max(normalizedTarget.length, normQ.length)
      const dist = levenshtein(normalizedTarget, normQ)
      const similarity = 1 - dist / maxLen
      if (similarity >= 0.8) {
        results.push({ id: q.id, text: q.text, score: similarity, layer: 'levenshtein' })
      }
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

// Bulk scan — loads all questions once, compares each unique pair exactly once.
//
// Scope-narrowing strategy:
//   1. Exact hash  → O(1) per pair, instant
//   2. Jaccard     → O(tokens) per pair, fast; threshold 0.7 to flag
//   3. Levenshtein → O(m×n) per pair, expensive; ONLY runs when:
//        a) Jaccard is in the 0.4–0.7 "suspicious" range (not flagged by Jaccard alone)
//        b) Both strings are short (< 200 chars), making the matrix affordable
//
// This means the expensive Levenshtein step only runs on a small fraction of pairs.
export async function runBulkDuplicateScan(
  onProgress: (scanned: number, total: number) => Promise<void>
): Promise<DuplicatePair[]> {
  const questions = await prisma.question.findMany({
    where: { status: { in: ['ACTIVE', 'FLAGGED'] } },
    select: { id: true, text: true },
  })

  const total = questions.length

  // Pre-compute everything we need once per question
  const processed = questions.map(q => {
    const norm = normalize(q.text)
    return {
      id: q.id,
      text: q.text,
      norm,
      hash: crypto.createHash('sha256').update(norm).digest('hex'),
      tokens: new Set(norm.split(' ').filter(Boolean)),
      short: q.text.length < 200,
    }
  })

  const pairs: DuplicatePair[] = []

  // O(n²/2) — each unique pair checked exactly once
  for (let i = 0; i < processed.length; i++) {
    const a = processed[i]

    for (let j = i + 1; j < processed.length; j++) {
      const b = processed[j]

      // Layer 1: exact hash
      if (a.hash === b.hash) {
        pairs.push({ aId: a.id, aText: a.text, bId: b.id, bText: b.text, score: 1.0, layer: 'exact', resolution: null })
        continue
      }

      // Layer 2: normalized exact
      if (a.norm === b.norm) {
        pairs.push({ aId: a.id, aText: a.text, bId: b.id, bText: b.text, score: 0.99, layer: 'normalized', resolution: null })
        continue
      }

      // Layer 3: Jaccard (pre-computed token sets)
      const jScore = jaccardSets(a.tokens, b.tokens)
      if (jScore >= 0.7) {
        pairs.push({ aId: a.id, aText: a.text, bId: b.id, bText: b.text, score: jScore, layer: 'jaccard', resolution: null })
        continue
      }

      // Layer 4: Levenshtein — only when worth it
      if (jScore >= 0.4 && a.short && b.short) {
        const maxLen = Math.max(a.norm.length, b.norm.length)
        const dist = levenshtein(a.norm, b.norm)
        const similarity = 1 - dist / maxLen
        if (similarity >= 0.8) {
          pairs.push({ aId: a.id, aText: a.text, bId: b.id, bText: b.text, score: similarity, layer: 'levenshtein', resolution: null })
        }
      }
    }

    // Report progress every 50 outer-loop rows to reduce DB write frequency
    if ((i + 1) % 50 === 0 || i + 1 === total) {
      await onProgress(i + 1, total)
    }
  }

  return pairs.sort((a, b) => b.score - a.score)
}
