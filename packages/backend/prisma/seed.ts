import Database from 'better-sqlite3'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

const DB_PATH = path.resolve(__dirname, '../../../db/trivia.db')

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

async function main() {
  console.log('Opening SQLite source:', DB_PATH)
  const sqlite = new Database(DB_PATH, { readonly: true })

  const questions = sqlite.prepare('SELECT * FROM questions').all() as SqliteQuestion[]
  const answers = sqlite.prepare('SELECT * FROM answers').all() as SqliteAnswer[]

  const answersByQuestion = new Map<string, SqliteAnswer[]>()
  for (const a of answers) {
    const list = answersByQuestion.get(a.question_id) ?? []
    list.push(a)
    answersByQuestion.set(a.question_id, list)
  }

  console.log(`Seeding ${questions.length} questions and ${answers.length} answers...`)

  let seeded = 0
  for (const q of questions) {
    const qAnswers = answersByQuestion.get(q.id) ?? []

    await prisma.question.upsert({
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
    seeded++
    if (seeded % 50 === 0) console.log(`  ${seeded}/${questions.length}`)
  }

  sqlite.close()
  console.log(`Done. Seeded ${seeded} questions.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
