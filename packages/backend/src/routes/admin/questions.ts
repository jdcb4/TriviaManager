import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'
import { runDuplicateDetection } from '../../services/duplicateDetection.js'

const app = new Hono()

const questionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER']).default('STANDARD'),
  points: z.number().int().min(0).default(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  collection: z.string().optional(),
  origin: z.string().optional(),
  status: z.enum(['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED']).default('ACTIVE'),
  isHidden: z.boolean().default(false),
  answers: z.array(z.object({
    id: z.string().optional(),
    text: z.string().min(1),
    isCorrect: z.boolean().default(true),
    order: z.number().int().default(0),
  })).default([]),
})

const listQuerySchema = z.object({
  type: z.enum(['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER']).optional(),
  category: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  status: z.enum(['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED']).optional(),
  collection: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// List all questions (admin sees all statuses)
app.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { type, category, difficulty, status, collection, search, page, limit } = c.req.valid('query')

  const where: any = {
    ...(type && { type }),
    ...(category && { category }),
    ...(difficulty && { difficulty }),
    ...(status && { status }),
    ...(collection && { collection }),
    ...(search && { text: { contains: search, mode: 'insensitive' } }),
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

  return c.json({ data: questions, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
})

// Get categories and collections for filter dropdowns
app.get('/meta', async (c) => {
  const [categories, collections, types] = await Promise.all([
    prisma.question.findMany({
      where: { category: { not: null } },
      select: { category: true, subCategory: true },
      distinct: ['category', 'subCategory'],
      orderBy: { category: 'asc' },
    }),
    prisma.collection.findMany({ orderBy: { name: 'asc' } }),
    prisma.question.groupBy({ by: ['type'], _count: true }),
  ])

  const catMap = new Map<string, Set<string>>()
  for (const { category, subCategory } of categories) {
    if (!category) continue
    if (!catMap.has(category)) catMap.set(category, new Set())
    if (subCategory) catMap.get(category)!.add(subCategory)
  }

  return c.json({
    categories: Array.from(catMap.entries()).map(([cat, subs]) => ({
      name: cat,
      subCategories: Array.from(subs),
    })),
    collections,
    typeCounts: types,
  })
})

// Get single question
app.get('/:id', async (c) => {
  const question = await prisma.question.findUnique({
    where: { id: c.req.param('id') },
    include: {
      answers: { orderBy: { order: 'asc' } },
      versions: { orderBy: { version: 'desc' }, take: 10 },
      feedback: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!question) return c.json({ error: 'Not found' }, 404)
  return c.json(question)
})

// Create question
app.post('/', zValidator('json', questionSchema), async (c) => {
  const { answers, ...data } = c.req.valid('json')

  // Get next version number
  const question = await prisma.question.create({
    data: {
      ...data,
      answers: { create: answers },
    },
    include: { answers: true },
  })

  await prisma.questionVersion.create({
    data: {
      questionId: question.id,
      version: 1,
      snapshot: question as any,
    },
  })

  return c.json(question, 201)
})

// Update question
app.put('/:id', zValidator('json', questionSchema.partial()), async (c) => {
  const id = c.req.param('id')
  const { answers, ...data } = c.req.valid('json')

  const existing = await prisma.question.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  // Get latest version number
  const latestVersion = await prisma.questionVersion.findFirst({
    where: { questionId: id },
    orderBy: { version: 'desc' },
  })

  const updated = await prisma.question.update({
    where: { id },
    data: {
      ...data,
      ...(answers !== undefined && {
        answers: {
          deleteMany: {},
          create: answers,
        },
      }),
    },
    include: { answers: true },
  })

  await prisma.questionVersion.create({
    data: {
      questionId: id,
      version: (latestVersion?.version ?? 0) + 1,
      snapshot: updated as any,
    },
  })

  return c.json(updated)
})

// Delete question
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.question.delete({ where: { id } }).catch(() => null)
  return c.json({ success: true })
})

// Run duplicate detection for a question
app.get('/:id/duplicates', async (c) => {
  const id = c.req.param('id')
  const question = await prisma.question.findUnique({ where: { id } })
  if (!question) return c.json({ error: 'Not found' }, 404)

  const results = await runDuplicateDetection(question.text, id)
  return c.json(results)
})

export default app
