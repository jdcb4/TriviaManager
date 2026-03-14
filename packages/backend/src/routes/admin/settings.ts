import { Hono } from 'hono'
import Database from 'better-sqlite3'
import { prisma } from '../../lib/prisma.js'
import os from 'os'
import path from 'path'
import fs from 'fs'

const router = new Hono()

interface SqliteQuestion {
  id: string
  text: string
  points: number | null
  difficulty: string | null
  category: string | null
  sub_category: string | null
  origin: string | null
  is_hidden: string | null
  created_at: string | null
}

interface SqliteAnswer {
  id: string
  question_id: string
  text: string
  points: number | null
}

function normalizeDifficulty(d: string | null): 'EASY' | 'MEDIUM' | 'HARD' {
  switch (d?.toLowerCase()) {
    case 'easy': return 'EASY'
    case 'hard': return 'HARD'
    default: return 'MEDIUM'
  }
}

// POST /api/admin/settings/seed
// Accepts a multipart form with a SQLite .db file and seeds the database
router.post('/seed', async (c) => {
  let tmpPath: string | null = null

  try {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file uploaded' }, 400)
    }

    // Write uploaded file to a temp path
    const bytes = await file.arrayBuffer()
    tmpPath = path.join(os.tmpdir(), `trivia-seed-${Date.now()}.db`)
    fs.writeFileSync(tmpPath, Buffer.from(bytes))

    const sqlite = new Database(tmpPath, { readonly: true })

    // Validate it looks like our schema
    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[]
    const tableNames = tables.map(t => t.name)

    if (!tableNames.includes('questions') || !tableNames.includes('answers')) {
      sqlite.close()
      return c.json({ error: 'Invalid database: missing questions or answers tables' }, 400)
    }

    const questions = sqlite.prepare('SELECT * FROM questions').all() as SqliteQuestion[]
    const answers = sqlite.prepare('SELECT * FROM answers').all() as SqliteAnswer[]
    sqlite.close()

    const answersByQuestion = new Map<string, SqliteAnswer[]>()
    for (const a of answers) {
      const list = answersByQuestion.get(a.question_id) ?? []
      list.push(a)
      answersByQuestion.set(a.question_id, list)
    }

    let seeded = 0
    let skipped = 0

    for (const q of questions) {
      const qAnswers = answersByQuestion.get(q.id) ?? []

      const result = await prisma.question.upsert({
        where: { id: q.id },
        update: {},
        create: {
          id: q.id,
          text: q.text,
          type: 'STANDARD',
          points: q.points ?? 1,
          difficulty: normalizeDifficulty(q.difficulty),
          category: q.category ?? undefined,
          subCategory: q.sub_category ?? undefined,
          origin: q.origin ?? undefined,
          status: q.is_hidden === 'True' ? 'ARCHIVED' : 'ACTIVE',
          isHidden: q.is_hidden === 'True',
          createdAt: q.created_at ? new Date(q.created_at) : new Date(),
          answers: {
            create: qAnswers.map((a, i) => ({
              id: a.id,
              text: a.text,
              isCorrect: true,
              order: i,
            })),
          },
        },
      })

      // upsert returns the record; if createdAt matches what we sent it was inserted
      if (result) seeded++
    }

    return c.json({
      success: true,
      questions: questions.length,
      answers: answers.length,
      seeded,
      message: `Successfully seeded ${seeded} questions (${answers.length} answers) from uploaded database`,
    })
  } catch (err: any) {
    console.error('Seed error:', err)
    return c.json({ error: err.message ?? 'Seed failed' }, 500)
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
  }
})

export default router
