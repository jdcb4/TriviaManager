import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'
import { generateDatasetFiles } from '../../services/fileGeneration.js'
import crypto from 'crypto'

const app = new Hono()

// Public: get current dataset version (for downstream sync detection)
export const publicVersionRouter = new Hono()
publicVersionRouter.get('/', async (c) => {
  const latest = await prisma.datasetVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: 'desc' },
  })
  return c.json(latest ?? { version: 0, checksum: '', questionCount: 0 })
})

// Admin: list all versions
app.get('/', async (c) => {
  const versions = await prisma.datasetVersion.findMany({ orderBy: { version: 'desc' } })
  return c.json(versions)
})

// Admin: publish a new dataset version + generate flat files
app.post('/publish', zValidator('json', z.object({ notes: z.string().optional() })), async (c) => {
  const { notes } = c.req.valid('json')

  const questions = await prisma.question.findMany({
    where: { status: 'ACTIVE', isHidden: false },
    include: { answers: { orderBy: { order: 'asc' } } },
    orderBy: { id: 'asc' },
  })

  // Compute checksum of sorted active questions
  const canonical = JSON.stringify(questions.map(q => ({ id: q.id, text: q.text, answers: q.answers })))
  const checksum = crypto.createHash('sha256').update(canonical).digest('hex')

  // Check if anything changed
  const latest = await prisma.datasetVersion.findFirst({ orderBy: { version: 'desc' } })
  if (latest?.checksum === checksum) {
    return c.json({ message: 'No changes since last publish', version: latest }, 200)
  }

  const version = await prisma.datasetVersion.create({
    data: { checksum, questionCount: questions.length, notes, publishedAt: new Date() },
  })

  // Generate flat files — errors are non-fatal (version record already saved)
  let fileWarning: string | undefined
  try {
    await generateDatasetFiles(questions as any)
  } catch (err: any) {
    fileWarning = err.message ?? 'Unknown file generation error'
    console.error('[publish] generateDatasetFiles failed:', fileWarning)
  }

  return c.json({ ...version, ...(fileWarning && { warning: fileWarning }) }, 201)
})

export default app
