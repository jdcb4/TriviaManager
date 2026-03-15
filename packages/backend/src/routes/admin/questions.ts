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
  // Single-value filters (kept for public API compat)
  type: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  status: z.string().optional(),
  collection: z.string().optional(),
  // Multi-value filters (comma-separated)
  types: z.string().optional(),
  categories: z.string().optional(),
  difficulties: z.string().optional(),
  statuses: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sortBy: z.enum(['createdAt', 'updatedAt', 'text', 'category', 'difficulty', 'status', 'type']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

// List all questions (admin sees all statuses)
app.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { type, category, difficulty, status, collection, types, categories, difficulties, statuses, search, page, limit, sortBy, sortDir } = c.req.valid('query')

  // Merge single + multi-value filters (multi-value wins if both provided)
  const typeList = types ? types.split(',').filter(Boolean) : type ? [type] : []
  const categoryList = categories ? categories.split(',').filter(Boolean) : category ? [category] : []
  const difficultyList = difficulties ? difficulties.split(',').filter(Boolean) : difficulty ? [difficulty] : []
  const statusList = statuses ? statuses.split(',').filter(Boolean) : status ? [status] : []

  const where: any = {
    ...(typeList.length === 1 ? { type: typeList[0] } : typeList.length > 1 ? { type: { in: typeList } } : {}),
    ...(categoryList.length === 1 ? { category: categoryList[0] } : categoryList.length > 1 ? { category: { in: categoryList } } : {}),
    ...(difficultyList.length === 1 ? { difficulty: difficultyList[0] } : difficultyList.length > 1 ? { difficulty: { in: difficultyList } } : {}),
    ...(statusList.length === 1 ? { status: statusList[0] } : statusList.length > 1 ? { status: { in: statusList } } : {}),
    ...(collection && { collection }),
    ...(search && { text: { contains: search, mode: 'insensitive' } }),
  }

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { answers: { orderBy: { order: 'asc' } } },
      orderBy: { [sortBy]: sortDir },
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

// Bulk update questions
app.post(
  '/bulk-update',
  zValidator('json', z.object({
    ids: z.array(z.string()).min(1),
    updates: z.object({
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
      status: z.enum(['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED']).optional(),
      category: z.string().nullable().optional(),
      collection: z.string().nullable().optional(),
    }),
  })),
  async (c) => {
    const { ids, updates } = c.req.valid('json')

    const data: any = {}
    if (updates.difficulty !== undefined) data.difficulty = updates.difficulty
    if (updates.status !== undefined) data.status = updates.status
    if (updates.category !== undefined) data.category = updates.category
    if (updates.collection !== undefined) data.collection = updates.collection

    if (Object.keys(data).length === 0) {
      return c.json({ error: 'No fields to update' }, 400)
    }

    const result = await prisma.question.updateMany({
      where: { id: { in: ids } },
      data,
    })

    return c.json({ updated: result.count })
  }
)

// Run duplicate detection for a question
app.get('/:id/duplicates', async (c) => {
  const id = c.req.param('id')
  const question = await prisma.question.findUnique({ where: { id } })
  if (!question) return c.json({ error: 'Not found' }, 404)

  const results = await runDuplicateDetection(question.text, id)
  return c.json(results)
})

export default app
