import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'

const app = new Hono()

const querySchema = z.object({
  // Accept comma-separated values for multi-select (e.g. type=STANDARD,MULTIPLE_CHOICE)
  // Single values remain backward-compatible.
  type: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  collection: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

app.get('/', zValidator('query', querySchema), async (c) => {
  const { type, category, difficulty, collection, page, limit } = c.req.valid('query')

  const types = type ? type.split(',').filter(Boolean) : []
  const categories = category ? category.split(',').filter(Boolean) : []
  const difficulties = difficulty ? difficulty.split(',').filter(Boolean) : []

  const where = {
    status: 'ACTIVE' as const,
    isHidden: false,
    ...(types.length === 1 && { type: types[0] as any }),
    ...(types.length > 1 && { type: { in: types as any[] } }),
    ...(categories.length === 1 && { category: categories[0] }),
    ...(categories.length > 1 && { category: { in: categories } }),
    ...(difficulties.length === 1 && { difficulty: difficulties[0] as any }),
    ...(difficulties.length > 1 && { difficulty: { in: difficulties as any[] } }),
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
