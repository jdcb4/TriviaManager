import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'
import { runBulkDuplicateScan } from '../../services/duplicateDetection.js'

const app = new Hono()

// Get the latest scan (status + results)
app.get('/scan/latest', async (c) => {
  const scan = await prisma.duplicateScan.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  return c.json(scan ?? null)
})

// Get a specific scan by id
app.get('/scan/:id', async (c) => {
  const scan = await prisma.duplicateScan.findUnique({
    where: { id: c.req.param('id') },
  })
  if (!scan) return c.json({ error: 'Not found' }, 404)
  return c.json(scan)
})

// Start a new bulk scan (async — returns immediately with scanId)
app.post('/scan', async (c) => {
  // Cancel any in-progress scans before starting a new one
  await prisma.duplicateScan.updateMany({
    where: { status: 'running' },
    data: { status: 'cancelled', completedAt: new Date() },
  })

  // Get question count upfront so the frontend can show accurate progress
  const totalQuestions = await prisma.question.count({
    where: { status: { in: ['ACTIVE', 'FLAGGED'] } },
  })

  const scan = await prisma.duplicateScan.create({
    data: { status: 'running', totalQuestions, scannedCount: 0 },
  })

  // Run the scan asynchronously — don't await
  ;(async () => {
    try {
      const pairs = await runBulkDuplicateScan(async (scanned) => {
        await prisma.duplicateScan.update({
          where: { id: scan.id },
          data: { scannedCount: scanned },
        })
      })

      await prisma.duplicateScan.update({
        where: { id: scan.id },
        data: {
          status: 'done',
          scannedCount: totalQuestions,
          results: { pairs } as any,
          completedAt: new Date(),
        },
      })
    } catch (err: any) {
      await prisma.duplicateScan.update({
        where: { id: scan.id },
        data: { status: 'failed', error: err.message, completedAt: new Date() },
      })
    }
  })()

  return c.json({ scanId: scan.id, totalQuestions }, 202)
})

// Resolve a duplicate pair
app.post(
  '/resolve',
  zValidator('json', z.object({
    scanId: z.string(),
    aId: z.string(),
    bId: z.string(),
    resolution: z.enum(['not_duplicate', 'archive_a', 'archive_b']),
  })),
  async (c) => {
    const { scanId, aId, bId, resolution } = c.req.valid('json')

    const scan = await prisma.duplicateScan.findUnique({ where: { id: scanId } })
    if (!scan) return c.json({ error: 'Scan not found' }, 404)

    const results = scan.results as { pairs: any[] } | null
    if (!results?.pairs) return c.json({ error: 'No results in this scan' }, 400)

    // Mark the pair as resolved
    const updatedPairs = results.pairs.map((p: any) => {
      const isMatch =
        (p.aId === aId && p.bId === bId) ||
        (p.aId === bId && p.bId === aId)
      return isMatch ? { ...p, resolution } : p
    })

    await prisma.duplicateScan.update({
      where: { id: scanId },
      data: { results: { pairs: updatedPairs } as any },
    })

    // Side-effect: archive the flagged question
    if (resolution === 'archive_a') {
      await prisma.question.update({
        where: { id: aId },
        data: { status: 'ARCHIVED', isHidden: true },
      })
    } else if (resolution === 'archive_b') {
      await prisma.question.update({
        where: { id: bId },
        data: { status: 'ARCHIVED', isHidden: true },
      })
    }

    return c.json({ success: true })
  }
)

export default app
