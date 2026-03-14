import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'

const app = new Hono()

app.get('/', async (c) => {
  const status = c.req.query('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined
  const staged = await prisma.stagedQuestion.findMany({
    where: { ...(status && { status }) },
    include: { question: { include: { answers: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return c.json(staged)
})

app.get('/:id', async (c) => {
  const item = await prisma.stagedQuestion.findUnique({
    where: { id: c.req.param('id') },
    include: { question: { include: { answers: true } } },
  })
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

// Approve: promote staged question to active
app.post('/:id/approve', zValidator('json', z.object({ reviewNotes: z.string().optional() })), async (c) => {
  const item = await prisma.stagedQuestion.findUnique({ where: { id: c.req.param('id') } })
  if (!item) return c.json({ error: 'Not found' }, 404)

  const data = item.data as any
  const { answers = [], ...questionData } = data

  let question: any
  if (item.questionId) {
    // Edit to existing question
    const existing = await prisma.question.findUnique({ where: { id: item.questionId } })
    const latestVersion = await prisma.questionVersion.findFirst({
      where: { questionId: item.questionId },
      orderBy: { version: 'desc' },
    })
    question = await prisma.question.update({
      where: { id: item.questionId },
      data: { ...questionData, answers: { deleteMany: {}, create: answers } },
      include: { answers: true },
    })
    await prisma.questionVersion.create({
      data: {
        questionId: question.id,
        version: (latestVersion?.version ?? 0) + 1,
        snapshot: question,
      },
    })
  } else {
    // New question
    question = await prisma.question.create({
      data: { ...questionData, status: 'ACTIVE', answers: { create: answers } },
      include: { answers: true },
    })
    await prisma.questionVersion.create({
      data: { questionId: question.id, version: 1, snapshot: question },
    })
  }

  await prisma.stagedQuestion.update({
    where: { id: item.id },
    data: { status: 'APPROVED', reviewNotes: c.req.valid('json').reviewNotes, reviewedAt: new Date() },
  })

  return c.json({ question })
})

// Reject staged question
app.post('/:id/reject', zValidator('json', z.object({ reviewNotes: z.string().optional() })), async (c) => {
  const updated = await prisma.stagedQuestion.update({
    where: { id: c.req.param('id') },
    data: { status: 'REJECTED', reviewNotes: c.req.valid('json').reviewNotes, reviewedAt: new Date() },
  })
  return c.json(updated)
})

// Update staged question data
app.put('/:id', zValidator('json', z.object({ data: z.any(), aiNotes: z.string().optional(), reviewNotes: z.string().optional() })), async (c) => {
  const updated = await prisma.stagedQuestion.update({
    where: { id: c.req.param('id') },
    data: c.req.valid('json'),
  })
  return c.json(updated)
})

// Bulk approve all PENDING staged questions
app.post('/approve-all', async (c) => {
  const pending = await prisma.stagedQuestion.findMany({
    where: { status: 'PENDING' },
  })

  const results = { approved: 0, failed: 0 }
  const now = new Date()

  for (const item of pending) {
    try {
      const data = item.data as any
      const { answers = [], ...questionData } = data

      if (item.questionId) {
        const latestVersion = await prisma.questionVersion.findFirst({
          where: { questionId: item.questionId },
          orderBy: { version: 'desc' },
        })
        const question = await prisma.question.update({
          where: { id: item.questionId },
          data: { ...questionData, answers: { deleteMany: {}, create: answers } },
          include: { answers: true },
        })
        await prisma.questionVersion.create({
          data: {
            questionId: question.id,
            version: (latestVersion?.version ?? 0) + 1,
            snapshot: question as any,
          },
        })
      } else {
        const question = await prisma.question.create({
          data: { ...questionData, status: 'ACTIVE', answers: { create: answers } },
          include: { answers: true },
        })
        await prisma.questionVersion.create({
          data: { questionId: question.id, version: 1, snapshot: question as any },
        })
      }

      await prisma.stagedQuestion.update({
        where: { id: item.id },
        data: { status: 'APPROVED', reviewedAt: now },
      })
      results.approved++
    } catch {
      results.failed++
    }
  }

  return c.json(results)
})

// Bulk reject all PENDING staged questions
app.post('/reject-all', zValidator('json', z.object({ reviewNotes: z.string().optional() })), async (c) => {
  const { reviewNotes } = c.req.valid('json')
  const result = await prisma.stagedQuestion.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'REJECTED', reviewNotes: reviewNotes ?? null, reviewedAt: new Date() },
  })
  return c.json({ rejected: result.count })
})

export default app
