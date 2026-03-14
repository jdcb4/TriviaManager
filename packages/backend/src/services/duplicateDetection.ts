import { prisma } from '../lib/prisma.js'
import crypto from 'crypto'

export interface DuplicateMatch {
  id: string
  text: string
  score: number
  layer: 'exact' | 'normalized' | 'jaccard' | 'levenshtein'
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function jaccard(a: string, b: string): number {
  const setA = new Set(a.split(' '))
  const setB = new Set(b.split(' '))
  const intersection = new Set([...setA].filter(w => setB.has(w)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
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

export async function runDuplicateDetection(
  text: string,
  excludeId?: string
): Promise<DuplicateMatch[]> {
  const normalizedTarget = normalize(text)
  const hashTarget = crypto.createHash('sha256').update(normalizedTarget).digest('hex')

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

    // Layer 3: Jaccard similarity (threshold: 0.7)
    const jScore = jaccard(normalizedTarget, normQ)
    if (jScore >= 0.7) {
      results.push({ id: q.id, text: q.text, score: jScore, layer: 'jaccard' })
      continue
    }

    // Layer 4: Levenshtein (only for short-ish strings, threshold: 80% similarity)
    if (text.length < 200) {
      const maxLen = Math.max(text.length, q.text.length)
      const dist = levenshtein(normalizedTarget, normQ)
      const similarity = 1 - dist / maxLen
      if (similarity >= 0.8) {
        results.push({ id: q.id, text: q.text, score: similarity, layer: 'levenshtein' })
      }
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
