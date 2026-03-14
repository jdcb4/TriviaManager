import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'

const app = new Hono()

const querySchema = z.object({
  type: z.enum(['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER']).optional(),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  collection: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

app.get('/', zValidator('query', querySchema), async (c) => {
  const { type, category, difficulty, collection, page, limit } = c.req.valid('query')

  const where = {
    status: 'ACTIVE' as const,
    isHidden: false,
    ...(type && { type }),
    ...(category && { category }),
    ...(difficulty && { difficulty }),
    ...(collection && { collection }),
  }

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { answers: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return c.json({
    data: questions,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  })
})

app.get('/:id', async (c) => {
  const question = await prisma.question.findFirst({
    where: { id: c.req.param('id'), status: 'ACTIVE', isHidden: false },
    include: { answers: { orderBy: { order: 'asc' } } },
  })

  if (!question) return c.json({ error: 'Not found' }, 404)
  return c.json(question)
})

export default app
