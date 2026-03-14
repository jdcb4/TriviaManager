import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'

const app = new Hono()

const FLAG_THRESHOLD = parseInt(process.env.FLAG_THRESHOLD ?? '3', 10)

// Public: submit feedback (no auth)
export const publicFeedbackRouter = new Hono()

publicFeedbackRouter.post(
  '/:questionId',
  zValidator('json', z.object({ rating: z.enum(['GOOD', 'BAD']), notes: z.string().max(500).optional() })),
  async (c) => {
    const questionId = c.req.param('questionId')
    const { rating, notes } = c.req.valid('json')

    const question = await prisma.question.findFirst({
      where: { id: questionId, status: 'ACTIVE', isHidden: false },
    })
    if (!question) return c.json({ error: 'Not found' }, 404)

    const feedback = await prisma.feedback.create({
      data: { questionId, rating, notes },
    })

    // Auto-flag if enough BAD ratings
    if (rating === 'BAD') {
      const badCount = await prisma.feedback.count({
        where: { questionId, rating: 'BAD' },
      })
      if (badCount >= FLAG_THRESHOLD) {
        await prisma.question.update({
          where: { id: questionId },
          data: { status: 'FLAGGED' },
        })
      }
    }

    return c.json(feedback, 201)
  }
)

// Admin: list feedback
app.get('/', async (c) => {
  const questionId = c.req.query('questionId')
  const rating = c.req.query('rating') as 'GOOD' | 'BAD' | undefined

  const feedback = await prisma.feedback.findMany({
    where: { ...(questionId && { questionId }), ...(rating && { rating }) },
    include: { question: { select: { id: true, text: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json(feedback)
})

// Admin: get queue of questions for swipe review (unanswered by this session)
app.get('/queue', async (c) => {
  const questions = await prisma.question.findMany({
    where: { status: 'ACTIVE', isHidden: false },
    select: {
      id: true, text: true, type: true, category: true, difficulty: true, points: true,
      answers: { select: { text: true, isCorrect: true, order: true }, orderBy: { order: 'asc' } },
      _count: { select: { feedback: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  return c.json(questions)
})

// Admin: delete feedback entry
app.delete('/:id', async (c) => {
  await prisma.feedback.delete({ where: { id: c.req.param('id') } }).catch(() => null)
  return c.json({ success: true })
})

export default app
