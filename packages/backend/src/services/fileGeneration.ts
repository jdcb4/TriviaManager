import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { stringify } from 'csv-stringify/sync'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOWNLOADS_DIR = path.resolve(__dirname, '../../public/downloads')

type Question = {
  id: string
  text: string
  type: string
  points: number
  difficulty: string
  category: string | null
  subCategory: string | null
  collection: string | null
  answers: Array<{ text: string; isCorrect: boolean; order: number }>
}

async function ensureDir() {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true })
}

export async function generateDatasetFiles(questions: Question[]): Promise<void> {
  await ensureDir()

  // Public-safe view: exclude admin fields
  const publicQuestions = questions.map(q => ({
    id: q.id,
    text: q.text,
    type: q.type,
    points: q.points,
    difficulty: q.difficulty,
    category: q.category,
    subCategory: q.subCategory,
    collection: q.collection,
    answers: q.answers,
  }))

  // JSON
  await fs.writeFile(
    path.join(DOWNLOADS_DIR, 'questions.json'),
    JSON.stringify(publicQuestions, null, 2),
    'utf-8'
  )

  // CSV (flattened — one row per answer, or one row per question with answers joined)
  const csvRows = questions.map(q => ({
    id: q.id,
    text: q.text,
    type: q.type,
    points: q.points,
    difficulty: q.difficulty,
    category: q.category ?? '',
    subCategory: q.subCategory ?? '',
    collection: q.collection ?? '',
    answers: q.answers.filter(a => a.isCorrect).map(a => a.text).join(' | '),
    allOptions: q.answers.map(a => a.text).join(' | '),
  }))

  const csv = stringify(csvRows, { header: true })
  await fs.writeFile(path.join(DOWNLOADS_DIR, 'questions.csv'), csv, 'utf-8')

  // SQLite
  const dbPath = path.join(DOWNLOADS_DIR, 'questions.db')
  try { await fs.unlink(dbPath) } catch {}
  const db = new Database(dbPath)

  db.exec(`
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      category TEXT,
      sub_category TEXT,
      collection TEXT
    );
    CREATE TABLE answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      "order" INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
    CREATE INDEX idx_answers_question ON answers(question_id);
    CREATE INDEX idx_questions_category ON questions(category);
    CREATE INDEX idx_questions_difficulty ON questions(difficulty);
    CREATE INDEX idx_questions_type ON questions(type);
  `)

  const insertQ = db.prepare(
    'INSERT INTO questions VALUES (?,?,?,?,?,?,?,?)'
  )
  const insertA = db.prepare(
    'INSERT INTO answers (question_id, text, is_correct, "order") VALUES (?,?,?,?)'
  )

  const insertAll = db.transaction((qs: Question[]) => {
    for (const q of qs) {
      insertQ.run(q.id, q.text, q.type, q.points, q.difficulty, q.category, q.subCategory, q.collection)
      for (const a of q.answers) {
        insertA.run(q.id, a.text, a.isCorrect ? 1 : 0, a.order)
      }
    }
  })

  insertAll(questions)
  db.close()
}
