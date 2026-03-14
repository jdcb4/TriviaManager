import { prisma } from '../lib/prisma.js'

interface IngestedQuestion {
  text: string
  type?: string
  points?: number
  difficulty?: string
  category?: string
  subCategory?: string
  collection?: string
  answers?: Array<{ text: string; isCorrect?: boolean; order?: number }>
  // CSV flat format
  answer?: string
  allOptions?: string
}

export interface IngestionResult {
  staged: number
  errors: string[]
}

function parseType(t?: string): string {
  const s = t?.toUpperCase() ?? ''
  if (s === 'MULTIPLE_CHOICE') return 'MULTIPLE_CHOICE'
  if (s === 'MULTIPLE_ANSWER') return 'MULTIPLE_ANSWER'
  return 'STANDARD'
}

function parseDifficulty(d?: string): string {
  const s = d?.toUpperCase() ?? ''
  if (s === 'EASY') return 'EASY'
  if (s === 'HARD') return 'HARD'
  return 'MEDIUM'
}

function buildAnswers(q: IngestedQuestion): Array<{ text: string; isCorrect: boolean; order: number }> {
  if (q.answers && Array.isArray(q.answers)) {
    return q.answers.map((a, i) => ({ text: a.text, isCorrect: a.isCorrect ?? true, order: a.order ?? i }))
  }
  // CSV flat format: answers field = correct answers pipe-separated
  const correct = q.answer?.split('|').map(s => s.trim()).filter(Boolean) ?? []
  const allOptions = q.allOptions?.split('|').map(s => s.trim()).filter(Boolean) ?? []

  if (allOptions.length > 0) {
    return allOptions.map((opt, i) => ({ text: opt, isCorrect: correct.includes(opt), order: i }))
  }
  return correct.map((text, i) => ({ text, isCorrect: true, order: i }))
}

async function parseCSV(text: string): Promise<{ rows: IngestedQuestion[]; errors: string[] }> {
  const lines = text.split('\n').filter(s => s.trim())
  if (lines.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row'] }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: IngestedQuestion[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    try {
      // Simple CSV parse (handles quoted fields)
      const values: string[] = []
      let inQuote = false, current = ''
      for (const char of lines[i]) {
        if (char === '"') { inQuote = !inQuote }
        else if (char === ',' && !inQuote) { values.push(current.trim()); current = '' }
        else { current += char }
      }
      values.push(current.trim())

      const row: any = {}
      headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
      if (row.text) rows.push(row)
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`)
    }
  }

  return { rows, errors }
}

export async function processIngestion(content: string, format: 'csv' | 'json'): Promise<IngestionResult> {
  const errors: string[] = []
  let questions: IngestedQuestion[] = []

  if (format === 'json') {
    try {
      const parsed = JSON.parse(content)
      questions = Array.isArray(parsed) ? parsed : [parsed]
    } catch (e: any) {
      return { staged: 0, errors: [`JSON parse error: ${e.message}`] }
    }
  } else {
    const { rows, errors: csvErrors } = await parseCSV(content)
    questions = rows
    errors.push(...csvErrors)
  }

  let staged = 0
  for (const q of questions) {
    if (!q.text?.trim()) {
      errors.push(`Skipping row with empty text`)
      continue
    }

    try {
      await prisma.stagedQuestion.create({
        data: {
          data: {
            text: q.text.trim(),
            type: parseType(q.type),
            points: Number(q.points) || 1,
            difficulty: parseDifficulty(q.difficulty),
            category: q.category || null,
            subCategory: q.subCategory || null,
            collection: q.collection || null,
            answers: buildAnswers(q),
          },
          source: format,
          status: 'PENDING',
        },
      })
      staged++
    } catch (e: any) {
      errors.push(`Failed to stage "${q.text?.slice(0, 50)}": ${e.message}`)
    }
  }

  return { staged, errors }
}
