import { Hono } from 'hono'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOWNLOADS_DIR = path.resolve(__dirname, '../../public/downloads')

const app = new Hono()

async function serveDownload(c: any, filename: string, contentType: string) {
  const filePath = path.join(DOWNLOADS_DIR, filename)
  try {
    const data = await fs.readFile(filePath)
    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return c.json({ error: 'File not yet generated. An admin must publish the dataset first.' }, 404)
  }
}

app.get('/csv', (c) => serveDownload(c, 'questions.csv', 'text/csv'))
app.get('/json', (c) => serveDownload(c, 'questions.json', 'application/json'))
app.get('/sqlite', (c) => serveDownload(c, 'questions.db', 'application/x-sqlite3'))

export default app
