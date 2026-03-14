import { Hono } from 'hono'
import { prisma } from '../../lib/prisma.js'
import { processIngestion } from '../../services/ingestion.js'

const app = new Hono()

app.post('/upload', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) return c.json({ error: 'No file provided' }, 400)

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'json'].includes(ext ?? '')) {
    return c.json({ error: 'Only CSV and JSON files are supported' }, 400)
  }

  const text = await file.text()
  const result = await processIngestion(text, ext as 'csv' | 'json')

  return c.json({
    staged: result.staged,
    errors: result.errors,
    message: `Staged ${result.staged} questions with ${result.errors.length} errors`,
  })
})

export default app
