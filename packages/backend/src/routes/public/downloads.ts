import { Hono } from 'hono'
import path from 'path'
import fs from 'fs/promises'
import { prisma } from '../../lib/prisma.js'
import { generateDatasetFiles, DOWNLOADS_DIR } from '../../services/fileGeneration.js'

const app = new Hono()

// Check that a published version exists, then ensure the file is on disk.
// If the file is missing (e.g. after a container restart wipes the filesystem),
// regenerate it on the fly from the database before serving.
// Convert a Node.js Buffer (Uint8Array<ArrayBufferLike>) to a plain ArrayBuffer.
// ArrayBuffer is a concrete BodyInit type and works in all TS versions.
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.length)
  new Uint8Array(ab).set(buf)
  return ab
}

async function getOrGenerateFile(filename: string): Promise<ArrayBuffer | null> {
  // Guard: only serve if at least one published version exists
  const latestVersion = await prisma.datasetVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: 'desc' },
  })
  if (!latestVersion) return null

  const filePath = path.join(DOWNLOADS_DIR, filename)

  try {
    return toArrayBuffer(await fs.readFile(filePath))
  } catch {
    // File missing (container restart resets the filesystem) — regenerate from DB
    const questions = await prisma.question.findMany({
      where: { status: 'ACTIVE', isHidden: false },
      include: { answers: { orderBy: { order: 'asc' } } },
      orderBy: { id: 'asc' },
    })
    await generateDatasetFiles(questions as any)
    return toArrayBuffer(await fs.readFile(filePath))
  }
}

async function serveDownload(c: any, filename: string, contentType: string) {
  try {
    const data = await getOrGenerateFile(filename)
    if (!data) {
      return c.json({ error: 'No published dataset yet. An admin must publish the dataset first.' }, 404)
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
app.get('/sqlite', (c) => serveDownload(c, 'questions.db',   'application/x-sqlite3'))

export default app
