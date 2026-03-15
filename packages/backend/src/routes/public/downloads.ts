import { Hono } from 'hono'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from '../../lib/prisma.js'
import { generateDatasetFiles, DOWNLOADS_DIR } from '../../services/fileGeneration.js'

const app = new Hono()

// Convert a Node.js Buffer to a plain ArrayBuffer (concrete BodyInit type).
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.length)
  new Uint8Array(ab).set(buf)
  return ab
}

// Three possible outcomes:
//   ArrayBuffer  – file is ready to serve
//   null         – no published dataset version exists yet
//   'unavailable' – version exists but file could not be generated
//                   (e.g. better-sqlite3 binary missing for .db files)
async function getOrGenerateFile(filename: string): Promise<ArrayBuffer | null | 'unavailable'> {
  // Guard: only serve if at least one published version exists
  const latestVersion = await prisma.datasetVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: 'desc' },
  })
  if (!latestVersion) return null

  const filePath = path.join(DOWNLOADS_DIR, filename)

  // Try to serve the cached file first
  try {
    return toArrayBuffer(await fs.readFile(filePath))
  } catch {
    // File missing (container restart) — regenerate from DB
    const questions = await prisma.question.findMany({
      where: { status: 'ACTIVE', isHidden: false },
      include: { answers: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'asc' },
    })
    await generateDatasetFiles(questions as any)

    // After generation, try to read the file again.
    // If it still doesn't exist (e.g. SQLite skipped because native binary
    // is unavailable), return 'unavailable' rather than throwing.
    try {
      return toArrayBuffer(await fs.readFile(filePath))
    } catch {
      return 'unavailable'
    }
  }
}

async function serveDownload(c: any, filename: string, contentType: string, unavailableMsg?: string) {
  try {
    const data = await getOrGenerateFile(filename)
    if (data === null) {
      return c.json({ error: 'No published dataset yet. An admin must publish the dataset first.' }, 404)
    }
    if (data === 'unavailable') {
      return c.json({
        error: unavailableMsg ?? 'This download format is not available on the current platform.',
      }, 503)
    }
    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err: any) {
    console.error('[downloads] Failed to serve', filename, err?.message)
    return c.json({ error: 'Failed to generate download file. Please try again or contact an admin.' }, 500)
  }
}

app.get('/csv',    (c) => serveDownload(c, 'questions.csv',  'text/csv'))
app.get('/json',   (c) => serveDownload(c, 'questions.json', 'application/json'))
app.get('/sqlite', (c) => serveDownload(c, 'questions.db',   'application/x-sqlite3',
  'SQLite download is not available on this deployment (native binary could not be compiled). Please use JSON or CSV instead.'))

export default app
