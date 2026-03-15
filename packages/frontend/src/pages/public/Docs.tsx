import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Book, Terminal, Code2, Database, Download, Zap, ChevronRight } from 'lucide-react'

// ── Shared helpers ────────────────────────────────────────────────────────────

function Code({ children, block = false }: { children: string; block?: boolean }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(children.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!block) {
    return (
      <code className="bg-gray-100 text-indigo-700 text-xs font-mono px-1.5 py-0.5 rounded">
        {children}
      </code>
    )
  }

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 text-xs font-mono rounded-xl p-4 overflow-x-auto leading-relaxed">
        <code>{children.trim()}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function Section({ id, title, icon: Icon, children }: {
  id: string; title: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <Icon size={18} className="text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-800 mt-6 mb-2">{children}</h3>
}

function ParamTable({ rows }: { rows: { name: string; type: string; default?: string; desc: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border rounded-xl overflow-hidden">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">Parameter</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-left">Default</th>
            <th className="px-4 py-2 text-left">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r => (
            <tr key={r.name}>
              <td className="px-4 py-2 font-mono text-indigo-700 text-xs">{r.name}</td>
              <td className="px-4 py-2 text-gray-500 text-xs">{r.type}</td>
              <td className="px-4 py-2 text-gray-400 text-xs">{r.default ?? '—'}</td>
              <td className="px-4 py-2 text-gray-700 text-xs">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ children, color = 'indigo' }: { children: string; color?: 'indigo' | 'green' | 'amber' | 'gray' }) {
  const cls = {
    indigo: 'bg-indigo-100 text-indigo-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
  }[color]
  return <span className={`text-xs font-medium px-2 py-0.5 rounded font-mono ${cls}`}>{children}</span>
}

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'api-questions', label: 'List Questions' },
  { id: 'api-single', label: 'Get Question' },
  { id: 'api-version', label: 'Dataset Version' },
  { id: 'api-downloads', label: 'Downloads' },
  { id: 'data-models', label: 'Data Models' },
  { id: 'examples', label: 'Code Examples' },
  { id: 'rate-limits', label: 'Rate Limits' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Docs() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></Link>
            <h1 className="font-bold text-indigo-700 text-lg">TriviaManager</h1>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-sm font-medium text-gray-600">API Docs</span>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/" className="text-gray-500 hover:text-indigo-600">Browse</Link>
            <Link to="/download" className="text-gray-500 hover:text-indigo-600">Download</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-10">
        {/* Sticky sidebar nav */}
        <aside className="hidden lg:block w-48 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contents</p>
            {NAV.map(n => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-12">

          {/* ── Overview ───────────────────────────────────────────────── */}
          <Section id="overview" title="Overview" icon={Book}>
            <p className="text-gray-600 leading-relaxed">
              TriviaManager exposes a public, read-only REST API for accessing the trivia question library.
              All endpoints return JSON and require no authentication. The API is rate-limited to protect
              availability for all consumers.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              {[
                { label: 'Base URL', value: window.location.origin },
                { label: 'Format', value: 'JSON (UTF-8)' },
                { label: 'Auth required', value: 'No (public endpoints)' },
                { label: 'Rate limit', value: '100 req / 15 min per IP' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-mono text-gray-800 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Quick Start ────────────────────────────────────────────── */}
          <Section id="quickstart" title="Quick Start" icon={Zap}>
            <p className="text-gray-600">Fetch your first batch of questions in one line:</p>
            <Code block>{`curl "${window.location.origin}/api/questions?limit=5&difficulty=EASY"`}</Code>
            <p className="text-gray-600 mt-4">Or in JavaScript:</p>
            <Code block>{`const res = await fetch('${window.location.origin}/api/questions?limit=5')
const { data, meta } = await res.json()

console.log(\`\${meta.total} total questions\`)
data.forEach(q => {
  const answer = q.answers.find(a => a.isCorrect)?.text
  console.log(\`Q: \${q.text} → A: \${answer}\`)
})`}</Code>
          </Section>

          {/* ── List Questions ─────────────────────────────────────────── */}
          <Section id="api-questions" title="List Questions" icon={Terminal}>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 font-mono text-sm">
              <Badge color="green">GET</Badge>
              <span className="text-gray-800">/api/questions</span>
            </div>
            <p className="text-gray-600">
              Returns a paginated list of active, publicly visible questions with their answers.
            </p>

            <H3>Query Parameters</H3>
            <ParamTable rows={[
              { name: 'page', type: 'integer', default: '1', desc: 'Page number (1-indexed)' },
              { name: 'limit', type: 'integer', default: '20', desc: 'Results per page (max 100)' },
              { name: 'search', type: 'string', desc: 'Full-text search on question text' },
              { name: 'type', type: 'string', desc: 'STANDARD · MULTIPLE_CHOICE · MULTIPLE_ANSWER' },
              { name: 'category', type: 'string', desc: 'Filter by category name (exact match)' },
              { name: 'difficulty', type: 'string', desc: 'EASY · MEDIUM · HARD' },
              { name: 'collection', type: 'string', desc: 'Filter by collection slug' },
            ]} />

            <H3>Example</H3>
            <Code block>{`GET /api/questions?difficulty=MEDIUM&category=History&page=1&limit=10`}</Code>

            <H3>Response</H3>
            <Code block>{`{
  "data": [
    {
      "id": "01234567-89ab-cdef-0123-456789abcdef",
      "text": "In which year did World War II end?",
      "type": "STANDARD",
      "points": 1,
      "difficulty": "MEDIUM",
      "category": "History",
      "subCategory": "World Wars",
      "collection": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "answers": [
        { "id": "...", "text": "1945", "isCorrect": true, "order": 0 }
      ]
    }
  ],
  "meta": {
    "total": 284,
    "page": 1,
    "limit": 10,
    "pages": 29
  }
}`}</Code>
          </Section>

          {/* ── Get Single Question ─────────────────────────────────────── */}
          <Section id="api-single" title="Get a Single Question" icon={Terminal}>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 font-mono text-sm">
              <Badge color="green">GET</Badge>
              <span className="text-gray-800">/api/questions/<span className="text-indigo-600">:id</span></span>
            </div>
            <p className="text-gray-600">
              Fetch a single question by its UUID. Returns <Code>404</Code> if the question doesn't exist,
              is archived, or is hidden.
            </p>

            <H3>Example</H3>
            <Code block>{`GET /api/questions/01234567-89ab-cdef-0123-456789abcdef`}</Code>
            <p className="text-sm text-gray-500 mt-2">Returns the same question object shape as above (without the <Code>data</Code>/<Code>meta</Code> wrapper).</p>
          </Section>

          {/* ── Dataset Version ─────────────────────────────────────────── */}
          <Section id="api-version" title="Dataset Version" icon={Terminal}>
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 font-mono text-sm">
              <Badge color="green">GET</Badge>
              <span className="text-gray-800">/api/dataset-version</span>
            </div>
            <p className="text-gray-600">
              Returns metadata about the current published dataset. Use the <Code>checksum</Code> field
              to detect when the dataset has changed — compare with your cached value and re-download
              the full file only when it differs.
            </p>

            <H3>Response</H3>
            <Code block>{`{
  "id": "...",
  "version": 7,
  "checksum": "a3f2c1b9e8d74a6f1b2c3d4e5f6a7b8c...",
  "questionCount": 1482,
  "notes": "Added 50 history questions",
  "createdAt": "2024-03-01T12:00:00.000Z",
  "publishedAt": "2024-03-01T12:05:00.000Z"
}`}</Code>
            <p className="text-sm text-gray-500 mt-1">
              If no dataset has been published yet, returns <Code>{"{ \"version\": 0, \"checksum\": \"\", \"questionCount\": 0 }"}</Code>.
            </p>

            <H3>Sync Pattern</H3>
            <Code block>{`// Efficient sync: only re-download when something changed
async function syncIfNeeded() {
  const { checksum, version } = await fetch('/api/dataset-version').then(r => r.json())
  const cached = localStorage.getItem('trivia_checksum')

  if (cached === checksum) return // already up to date

  console.log(\`New dataset v\${version} available — downloading…\`)
  const questions = await fetch('/api/downloads/json').then(r => r.json())
  localStorage.setItem('trivia_checksum', checksum)
  return questions
}`}</Code>
          </Section>

          {/* ── Downloads ───────────────────────────────────────────────── */}
          <Section id="api-downloads" title="Bulk Downloads" icon={Download}>
            <p className="text-gray-600">
              Download the full active dataset in your preferred format. Files are pre-generated by the
              admin when publishing a new dataset version. They're served with a 1-hour cache header and
              regenerated automatically if missing.
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ A dataset must be published before downloads are available — requests return <Code>404</Code> otherwise.
            </p>

            <div className="space-y-4 mt-4">
              {/* JSON */}
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 font-mono text-sm border-b">
                  <Badge color="green">GET</Badge>
                  <span className="text-gray-800">/api/downloads/json</span>
                  <span className="ml-auto text-xs text-gray-400">application/json</span>
                </div>
                <div className="p-4 text-sm text-gray-600">
                  JSON array of all active questions. Each object matches the API response shape
                  (excluding admin-only fields like <Code>status</Code> and <Code>isHidden</Code>).
                </div>
              </div>

              {/* CSV */}
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 font-mono text-sm border-b">
                  <Badge color="green">GET</Badge>
                  <span className="text-gray-800">/api/downloads/csv</span>
                  <span className="ml-auto text-xs text-gray-400">text/csv</span>
                </div>
                <div className="p-4 text-sm text-gray-600 space-y-2">
                  <p>Spreadsheet-friendly format. One row per question. Columns:</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-gray-500">
                    {['id', 'text', 'type', 'points', 'difficulty', 'category', 'subCategory', 'collection', 'answers', 'allOptions'].map(col => (
                      <span key={col}>• {col}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    <Code>answers</Code> = pipe-separated correct answers &nbsp;|&nbsp; <Code>allOptions</Code> = all options including wrong ones (useful for MULTIPLE_CHOICE)
                  </p>
                </div>
              </div>

              {/* SQLite */}
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 font-mono text-sm border-b">
                  <Badge color="green">GET</Badge>
                  <span className="text-gray-800">/api/downloads/sqlite</span>
                  <span className="ml-auto text-xs text-gray-400">application/x-sqlite3</span>
                </div>
                <div className="p-4 text-sm text-gray-600 space-y-3">
                  <p>Portable SQLite database with two tables and indexes. Ideal for embedding in apps.</p>
                  <Code block>{`-- questions table
SELECT id, text, type, points, difficulty, category, sub_category, collection
FROM questions
WHERE difficulty = 'EASY';

-- answers table (join to get options)
SELECT q.text, a.text as answer, a.is_correct
FROM questions q
JOIN answers a ON a.question_id = q.id
WHERE q.id = '01234567-...';`}</Code>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Data Models ─────────────────────────────────────────────── */}
          <Section id="data-models" title="Data Models" icon={Database}>
            <H3>Question Types</H3>
            <div className="space-y-2">
              {[
                { type: 'STANDARD', desc: 'Single correct answer. No wrong options are stored.', example: 'What is the capital of France? → Paris' },
                { type: 'MULTIPLE_CHOICE', desc: 'Exactly 4 answer options; exactly 1 is correct (isCorrect: true). The others are plausible distractors (isCorrect: false).', example: 'Which planet is largest? → Jupiter ✓, Saturn, Neptune, Mars' },
                { type: 'MULTIPLE_ANSWER', desc: 'All stored answers are correct (isCorrect: true). The question asks for N of them (e.g. "Name 3 of the 5 oceans").', example: 'Name 3 of the 5 oceans → Pacific, Atlantic, Indian, Arctic, Southern (all correct)' },
              ].map(({ type, desc, example }) => (
                <div key={type} className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="indigo">{type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{desc}</p>
                  <p className="text-xs text-gray-400 mt-1 italic">e.g. {example}</p>
                </div>
              ))}
            </div>

            <H3>Difficulty</H3>
            <div className="flex gap-2">
              {['EASY', 'MEDIUM', 'HARD'].map(d => <Badge key={d} color="gray">{d}</Badge>)}
            </div>

            <H3>Categories</H3>
            <div className="flex flex-wrap gap-2">
              {[
                'Science & Nature', 'History', 'Geography', 'Entertainment',
                'Sports & Leisure', 'Arts & Literature', 'Food & Drink',
                'Technology', 'Music', 'General Knowledge',
              ].map(c => <Badge key={c} color="gray">{c}</Badge>)}
            </div>

            <H3>Answer Object</H3>
            <Code block>{`{
  "id":        string,   // UUID
  "text":      string,   // Answer text
  "isCorrect": boolean,  // true = correct answer
  "order":     number    // Display order (0-indexed)
}`}</Code>

            <H3>Question Object (full shape)</H3>
            <Code block>{`{
  "id":          string,         // UUID
  "text":        string,         // Question text
  "type":        "STANDARD" | "MULTIPLE_CHOICE" | "MULTIPLE_ANSWER",
  "points":      number,         // Point value (≥1; MULTIPLE_ANSWER = N asked for)
  "difficulty":  "EASY" | "MEDIUM" | "HARD",
  "category":    string | null,  // Primary category
  "subCategory": string | null,  // Optional sub-category
  "collection":  string | null,  // Collection slug
  "createdAt":   string,         // ISO 8601 timestamp
  "updatedAt":   string,
  "answers":     Answer[]
}`}</Code>
          </Section>

          {/* ── Code Examples ───────────────────────────────────────────── */}
          <Section id="examples" title="Code Examples" icon={Code2}>
            <H3>JavaScript — fetch all pages</H3>
            <Code block>{`async function fetchAllQuestions(filters = {}) {
  const questions = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({ page, limit: 100, ...filters })
    const { data, meta } = await fetch(\`/api/questions?\${params}\`).then(r => r.json())
    questions.push(...data)
    if (page >= meta.pages) break
    page++
  }

  return questions
}

// Usage
const historyQuestions = await fetchAllQuestions({ category: 'History', difficulty: 'HARD' })
console.log(historyQuestions.length, 'hard history questions')`}</Code>

            <H3>Python — requests</H3>
            <Code block>{`import requests

BASE = "https://your-domain"

def get_questions(page=1, limit=50, **filters):
    return requests.get(
        f"{BASE}/api/questions",
        params={"page": page, "limit": limit, **filters}
    ).json()

def fetch_all(**filters):
    questions, page = [], 1
    while True:
        resp = get_questions(page=page, limit=100, **filters)
        questions.extend(resp["data"])
        if page >= resp["meta"]["pages"]:
            break
        page += 1
    return questions

# Fetch all multiple-choice questions
mc_questions = fetch_all(type="MULTIPLE_CHOICE")
print(f"{len(mc_questions)} multiple-choice questions")`}</Code>

            <H3>Python — load SQLite download</H3>
            <Code block>{`import sqlite3
import requests

# Download the SQLite file
resp = requests.get("https://your-domain/api/downloads/sqlite")
with open("questions.db", "wb") as f:
    f.write(resp.content)

# Query it
con = sqlite3.connect("questions.db")
con.row_factory = sqlite3.Row

rows = con.execute("""
  SELECT q.id, q.text, q.difficulty, a.text AS answer
  FROM questions q
  JOIN answers a ON a.question_id = q.id AND a.is_correct = 1
  WHERE q.difficulty = 'EASY'
  LIMIT 5
""").fetchall()

for row in rows:
    print(f"Q: {row['text']}")
    print(f"A: {row['answer']}")
    print()`}</Code>

            <H3>Checking for updates before each game session</H3>
            <Code block>{`// Store checksum in your app's local state / AsyncStorage / etc.
let cachedChecksum = null
let cachedQuestions = []

async function getQuestions() {
  const version = await fetch('/api/dataset-version').then(r => r.json())

  if (version.checksum !== cachedChecksum) {
    cachedQuestions = await fetch('/api/downloads/json').then(r => r.json())
    cachedChecksum = version.checksum
    console.log(\`Updated to v\${version.version}: \${version.questionCount} questions\`)
  }

  return cachedQuestions
}`}</Code>
          </Section>

          {/* ── Rate Limits ─────────────────────────────────────────────── */}
          <Section id="rate-limits" title="Rate Limits" icon={Zap}>
            <p className="text-gray-600">
              Public endpoints are rate-limited to protect service availability.
            </p>
            <div className="bg-gray-50 border rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Limit</span>
                <span className="font-semibold text-gray-900">100 requests per 15 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Scope</span>
                <span className="font-semibold text-gray-900">Per IP address</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Applies to</span>
                <span className="font-semibold text-gray-900">
                  <Code>/api/questions</Code>, <Code>/api/downloads/*</Code>, <Code>/api/dataset-version</Code>
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              For high-volume use cases, download the full dataset via <Code>/api/downloads/json</Code> and cache it locally.
              Check <Code>/api/dataset-version</Code> (1 request) to determine if a re-download is needed before each session.
            </p>
          </Section>

        </main>
      </div>
    </div>
  )
}
