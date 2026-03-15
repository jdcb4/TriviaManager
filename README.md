# TriviaManager

A full-stack trivia question management platform. TriviaManager is a central question library — questions are authored and curated through an authenticated admin interface and served to consumer apps via a public REST API.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Public API Reference](#public-api-reference)
  - [List Questions](#list-questions)
  - [Get a Single Question](#get-a-single-question)
  - [Dataset Version](#dataset-version)
  - [Bulk Downloads](#bulk-downloads)
- [Data Models](#data-models)
- [Admin Features](#admin-features)
- [Deployment](#deployment)

---

## Features

- **Public REST API** — paginated, filterable question feed consumed by any app
- **Bulk downloads** — full dataset as JSON, CSV, or SQLite
- **Admin dashboard** — full question lifecycle management (create, edit, archive, stage, review)
- **AI generation** — generate trivia questions via OpenRouter (GPT-4o, Claude, Gemini, DeepSeek, and more)
- **Duplicate detection** — 4-layer heuristic scan with manual review or auto-archive
- **Staging workflow** — questions go through a PENDING → APPROVED/REJECTED review step
- **Versioning** — publish immutable dataset snapshots with SHA-256 checksums for downstream sync
- **Feedback system** — public swipe-based feedback; questions auto-flagged after a configurable BAD vote threshold

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | [Hono](https://hono.dev/) + Node.js + TypeScript |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| UI components | shadcn/ui |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (single-admin password) |
| Rate limiting | hono-rate-limiter |
| AI | [OpenRouter](https://openrouter.ai/) |
| Deployment | Railway + Docker |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for local PostgreSQL)

### 1. Clone and install

```bash
git clone https://github.com/jdcb4/TriviaManager.git
cd TriviaManager
pnpm install
pnpm approve-builds   # allow Prisma and better-sqlite3 native builds
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ADMIN_PASSWORD at minimum
```

### 3. Start PostgreSQL

```bash
docker-compose up postgres -d
```

### 4. Run migrations and seed

```bash
pnpm db:push     # apply schema to the local database
pnpm db:seed     # optional: import questions from db/trivia.db
```

### 5. Start the dev server

```bash
pnpm dev         # starts backend (:3000) and frontend (:5173) concurrently
```

Open [http://localhost:5173](http://localhost:5173) for the public site, [http://localhost:5173/admin](http://localhost:5173/admin) for the admin dashboard.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret for signing JWT tokens (min 32 chars) |
| `ADMIN_PASSWORD` | ✅ | — | Password for the admin dashboard |
| `OPEN_ROUTER_API_KEY` | — | — | Enables AI generation features |
| `FLAG_THRESHOLD` | — | `3` | Number of BAD feedback votes before a question is auto-flagged |
| `PORT` | — | `3000` | Backend server port |
| `NODE_ENV` | — | `development` | Set to `production` in Docker |

---

## Project Structure

```
TriviaManager/
├── packages/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema
│   │   │   └── seed.ts               # Imports from db/trivia.db
│   │   └── src/
│   │       ├── index.ts              # Hono app entry point
│   │       ├── lib/prisma.ts         # Prisma client singleton
│   │       ├── middleware/
│   │       │   ├── auth.ts           # JWT verification middleware
│   │       │   └── rateLimit.ts      # Public rate limiting
│   │       ├── routes/
│   │       │   ├── public/           # Unauthenticated routes
│   │       │   │   ├── questions.ts  # GET /api/questions
│   │       │   │   └── downloads.ts  # GET /api/downloads/*
│   │       │   └── admin/            # JWT-protected routes
│   │       │       ├── auth.ts       # POST /api/admin/auth/login
│   │       │       ├── questions.ts  # CRUD + bulk update
│   │       │       ├── staging.ts    # Review queue
│   │       │       ├── versions.ts   # Dataset versioning
│   │       │       ├── ai.ts         # AI generation
│   │       │       ├── duplicates.ts # Duplicate scanning
│   │       │       └── ...
│   │       └── services/
│   │           ├── duplicateDetection.ts  # 4-layer heuristic matching
│   │           ├── fileGeneration.ts      # CSV / JSON / SQLite export
│   │           └── openrouter.ts          # OpenRouter API client
│   └── frontend/
│       └── src/
│           ├── pages/
│           │   ├── public/           # Browse, Download, Docs, Feedback
│           │   └── admin/            # Dashboard, Questions, Staging, …
│           └── lib/
│               ├── api.ts            # Axios instance + shared types
│               ├── auth.ts           # JWT helpers
│               └── categories.ts     # Predefined category list
├── db/
│   └── trivia.db                     # Source data for seed
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Public API Reference

Base URL (production): `https://<your-railway-domain>`
Base URL (local dev): `http://localhost:3000`

Rate limit: **100 requests per 15 minutes** per IP address.

All responses are JSON. Dates are ISO 8601 strings. IDs are UUIDs.

---

### List Questions

```
GET /api/questions
```

Returns a paginated list of active, visible questions with their answers.

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Results per page (max: `100`) |
| `search` | string | — | Full-text search on question text |
| `type` | string | — | Filter by type: `STANDARD`, `MULTIPLE_CHOICE`, `MULTIPLE_ANSWER` |
| `category` | string | — | Filter by category (e.g. `Science & Nature`) |
| `difficulty` | string | — | Filter by difficulty: `EASY`, `MEDIUM`, `HARD` |
| `collection` | string | — | Filter by collection slug |

#### Example Request

```bash
curl "https://your-domain/api/questions?difficulty=EASY&category=Science%20%26%20Nature&limit=5"
```

#### Example Response

```json
{
  "data": [
    {
      "id": "01234567-89ab-cdef-0123-456789abcdef",
      "text": "What is the chemical symbol for water?",
      "type": "STANDARD",
      "points": 1,
      "difficulty": "EASY",
      "category": "Science & Nature",
      "subCategory": "Chemistry",
      "collection": null,
      "status": "ACTIVE",
      "isHidden": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "answers": [
        { "id": "...", "text": "H2O", "isCorrect": true, "order": 0 }
      ]
    }
  ],
  "meta": {
    "total": 1482,
    "page": 1,
    "limit": 5,
    "pages": 297
  }
}
```

---

### Get a Single Question

```
GET /api/questions/:id
```

Returns a single active question by its UUID.

#### Example Request

```bash
curl "https://your-domain/api/questions/01234567-89ab-cdef-0123-456789abcdef"
```

Returns the same question object shape as above (without the `data`/`meta` wrapper), or `404` if not found / not active.

---

### Dataset Version

```
GET /api/dataset-version
```

Returns the current published dataset version. Use this to detect when the dataset has changed without downloading the full file.

#### Example Response

```json
{
  "id": "...",
  "version": 7,
  "checksum": "a3f2c1b9e8d74a6f...",
  "questionCount": 1482,
  "notes": "Added 50 history questions",
  "createdAt": "2024-03-01T12:00:00.000Z",
  "publishedAt": "2024-03-01T12:05:00.000Z"
}
```

If no dataset has been published yet, returns `{ "version": 0, "checksum": "", "questionCount": 0 }`.

**Recommended pattern for consumer apps:**

```javascript
// 1. Fetch current version
const { checksum } = await fetch('/api/dataset-version').then(r => r.json())

// 2. Compare with locally cached checksum
if (checksum !== localChecksum) {
  // 3. Re-download the dataset
  const data = await fetch('/api/downloads/json').then(r => r.json())
  localChecksum = checksum
  // save data...
}
```

---

### Bulk Downloads

These endpoints return the full active dataset as a downloadable file. A dataset must be published by an admin first; requests return `404` otherwise.

Downloads are cached and served from disk. They are regenerated automatically if the cached file is missing (e.g. after a container restart).

**Cache-Control:** `public, max-age=3600`

#### JSON

```
GET /api/downloads/json
```

Returns a JSON array of all active questions. Each question object matches the shape described in [List Questions](#list-questions) minus admin-only fields (`status`, `isHidden`).

#### CSV

```
GET /api/downloads/csv
```

Returns a UTF-8 CSV file with one row per question.

| Column | Description |
|---|---|
| `id` | Question UUID |
| `text` | Question text |
| `type` | `STANDARD`, `MULTIPLE_CHOICE`, or `MULTIPLE_ANSWER` |
| `points` | Point value |
| `difficulty` | `EASY`, `MEDIUM`, or `HARD` |
| `category` | Primary category |
| `subCategory` | Sub-category |
| `collection` | Collection slug |
| `answers` | Pipe-separated correct answers |
| `allOptions` | Pipe-separated all answer options (useful for MULTIPLE_CHOICE) |

#### SQLite

```
GET /api/downloads/sqlite
```

Returns a portable SQLite database file (`questions.db`) containing two tables:

```sql
-- questions table
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

-- answers table
CREATE TABLE answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL REFERENCES questions(id),
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL,   -- 1 = true, 0 = false
  "order" INTEGER NOT NULL
);
```

Indexed on `answers.question_id`, `questions.category`, `questions.difficulty`, `questions.type`.

---

## Data Models

### Question Types

| Type | Description |
|---|---|
| `STANDARD` | Single correct answer (no wrong options stored) |
| `MULTIPLE_CHOICE` | Exactly 4 options, exactly 1 correct (`isCorrect: true`) |
| `MULTIPLE_ANSWER` | Multiple valid answers (e.g. "Name 3 of the 5 oceans"); all stored answers have `isCorrect: true` |

### Difficulty Levels

`EASY` · `MEDIUM` · `HARD`

### Categories

The predefined category list:

- Science & Nature
- History
- Geography
- Entertainment
- Sports & Leisure
- Arts & Literature
- Food & Drink
- Technology
- Music
- General Knowledge

### Answer Object

```typescript
{
  id: string          // UUID
  text: string        // Answer text
  isCorrect: boolean  // true = correct, false = wrong option (MULTIPLE_CHOICE only)
  order: number       // Display order (0-indexed)
}
```

---

## Code Examples

### JavaScript (fetch)

```javascript
// List EASY Science questions
const res = await fetch(
  'https://your-domain/api/questions?difficulty=EASY&category=Science%20%26%20Nature&limit=10'
)
const { data, meta } = await res.json()
console.log(`${meta.total} questions found`)
data.forEach(q => console.log(q.text, '→', q.answers.find(a => a.isCorrect)?.text))
```

### Python (requests)

```python
import requests

BASE_URL = "https://your-domain"

# Fetch all HARD questions (paginated)
def fetch_all_hard_questions():
    questions = []
    page = 1
    while True:
        r = requests.get(f"{BASE_URL}/api/questions", params={
            "difficulty": "HARD",
            "limit": 100,
            "page": page,
        })
        data = r.json()
        questions.extend(data["data"])
        if page >= data["meta"]["pages"]:
            break
        page += 1
    return questions
```

### Sync pattern (JavaScript)

```javascript
const CACHE_KEY = 'trivia_checksum'

async function syncDataset() {
  const { checksum, version } = await fetch('/api/dataset-version').then(r => r.json())
  const cached = localStorage.getItem(CACHE_KEY)

  if (cached === checksum) {
    console.log('Dataset up to date')
    return
  }

  console.log(`Downloading dataset v${version}…`)
  const questions = await fetch('/api/downloads/json').then(r => r.json())
  localStorage.setItem(CACHE_KEY, checksum)
  return questions
}
```

---

## Admin Features

Access the admin dashboard at `/admin` (requires `ADMIN_PASSWORD`).

| Feature | Description |
|---|---|
| **Questions** | Full CRUD, bulk edit (difficulty / status / category / collection), multi-select filters, sortable table |
| **Staging** | Review queue for AI-generated or imported questions before they go live |
| **AI Generate** | Generate questions by category, difficulty, and type via OpenRouter (20+ models) |
| **Duplicate Detection** | Heuristic scan (exact hash → normalized → Jaccard → Levenshtein); auto-archive exact duplicates; multi-select batch resolution |
| **Versions** | Publish immutable dataset snapshots; regenerate download files |
| **Collections** | Group questions into named collections |
| **Ingestion** | Bulk import from CSV or JSON |
| **Feedback** | View and analyse public feedback; questions auto-flagged at threshold |

---

## Deployment

### Railway (recommended)

1. Fork the repo and connect to Railway
2. Set environment variables in the Railway dashboard
3. Railway will build using the `Dockerfile` automatically
4. The release command (`prisma migrate deploy`) runs on each deploy

### Docker (self-hosted)

```bash
# Build
docker build -t trivia-manager .

# Run (with external Postgres)
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/trivia \
  -e JWT_SECRET=your-secret \
  -e ADMIN_PASSWORD=your-password \
  trivia-manager
```

### Local development with Docker Compose

```bash
docker-compose up        # starts postgres + app
docker-compose up --build  # rebuild after code changes
```

---

## License

MIT
