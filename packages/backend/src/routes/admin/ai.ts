import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'
import { openrouterChat } from '../../services/openrouter.js'
import { runDuplicateDetection } from '../../services/duplicateDetection.js'

const app = new Hono()

const MODELS = [
  // OpenAI
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/o3-mini',
  // Anthropic
  'anthropic/claude-3-5-haiku',
  'anthropic/claude-3-7-sonnet',
  'anthropic/claude-3-opus',
  // Google Gemini (current generation)
  'google/gemini-2.5-pro-preview',
  'google/gemini-2.5-flash-preview',
  'google/gemini-2.0-flash',
  'google/gemini-2.0-flash-lite',
  // DeepSeek
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1',
  'deepseek/deepseek-r1-distill-llama-70b',
  // Qwen
  'qwen/qwen-2.5-72b-instruct',
  'qwen/qwq-32b',
  'qwen/qwen-turbo',
  // Meta
  'meta-llama/llama-3.3-70b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  // Mistral
  'mistral/mistral-large-2411',
  'mistral/mistral-small-3.1-24b-instruct',
]

app.get('/models', async (c) => {
  return c.json(MODELS)
})

app.get('/tasks', async (c) => {
  const tasks = await prisma.aiTask.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return c.json(tasks)
})

app.get('/tasks/:id', async (c) => {
  const task = await prisma.aiTask.findUnique({ where: { id: c.req.param('id') } })
  if (!task) return c.json({ error: 'Not found' }, 404)
  return c.json(task)
})

// Generate questions via AI
app.post(
  '/generate',
  zValidator('json', z.object({
    model: z.string(),
    count: z.number().int().min(1).max(20).default(5),
    category: z.string().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    type: z.enum(['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER']).default('STANDARD'),
    instructions: z.string().optional(),
  })),
  async (c) => {
    if (!process.env.OPEN_ROUTER_API_KEY) {
      return c.json({ error: 'OPEN_ROUTER_API_KEY not configured' }, 503)
    }

    const body = c.req.valid('json')

    const task = await prisma.aiTask.create({
      data: { type: 'generate', status: 'running', model: body.model, prompt: JSON.stringify(body) },
    })

    // Run async (don't await in request, update task when done)
    ;(async () => {
      try {
        const typeInstructions: Record<string, string> = {
          STANDARD: `Each question has exactly ONE correct answer.
- The "answers" array must contain exactly 1 object with isCorrect:true.
- Do NOT include wrong options.`,

          MULTIPLE_CHOICE: `Each question is a multiple-choice question with EXACTLY 4 answer options.
- The "answers" array must contain EXACTLY 4 objects — no more, no fewer.
- EXACTLY ONE answer has isCorrect:true (the correct answer).
- The other THREE answers have isCorrect:false (plausible but clearly wrong distractors).
- CRITICAL: if you include fewer or more than 4 answer objects the response is invalid.
- CRITICAL: do NOT mark more than one answer as isCorrect:true.`,

          MULTIPLE_ANSWER: `Each question asks players to name N items from a larger set of valid answers.
- The "answers" array must contain ALL valid answers that exist (not just N of them).
- ALL answers in the array have isCorrect:true.
- CRITICAL: include every valid answer, even if the question only requires naming N of them.
- Example: "Name 3 of the 5 oceans" → provide all 5 oceans (all isCorrect:true).
- Example: "Name 3 noble gases" → provide all 7 noble gases (all isCorrect:true).
- Phrase the question as "Name [N] of the [category]..." to signal there are more valid answers.`,
        }

        const typeExamples: Record<string, string> = {
          STANDARD: `[{"text":"What is the capital of France?","answers":[{"text":"Paris","isCorrect":true,"order":0}],"category":"Geography","difficulty":"EASY"}]`,
          MULTIPLE_CHOICE: `[{"text":"Which planet is the largest in our solar system?","answers":[{"text":"Jupiter","isCorrect":true,"order":0},{"text":"Saturn","isCorrect":false,"order":1},{"text":"Neptune","isCorrect":false,"order":2},{"text":"Mars","isCorrect":false,"order":3}],"category":"Science","difficulty":"EASY"}]`,
          MULTIPLE_ANSWER: `[{"text":"Name 3 of the 5 oceans on Earth.","answers":[{"text":"Pacific","isCorrect":true,"order":0},{"text":"Atlantic","isCorrect":true,"order":1},{"text":"Indian","isCorrect":true,"order":2},{"text":"Arctic","isCorrect":true,"order":3},{"text":"Southern","isCorrect":true,"order":4}],"category":"Geography","difficulty":"MEDIUM"}]`,
        }

        // Random seed to encourage diverse outputs across requests
        const seed = Math.floor(Math.random() * 1_000_000)
        const randomHints = [
          'Avoid the most famous/obvious examples — think of interesting edge cases.',
          'Surprise me with unusual angles on the topic.',
          'Prefer questions about lesser-known but verifiable facts.',
          'Include some questions that would stump even knowledgeable players.',
          'Include some questions with surprising or counterintuitive answers.',
        ]
        const randomHint = randomHints[seed % randomHints.length]

        const prompt = `Generate exactly ${body.count} trivia questions${body.category ? ` about ${body.category}` : ''} at ${body.difficulty ?? 'MEDIUM'} difficulty.

QUESTION TYPE: ${body.type}
${typeInstructions[body.type]}
${body.instructions ? `\nAdditional instructions: ${body.instructions}` : ''}

VARIETY (seed ${seed}): ${randomHint} Generate diverse questions — avoid repeating the same subject or answer across the batch.

Respond ONLY with a valid JSON array. Each element must have:
- "text": the question text
- "answers": array of objects with "text" (string), "isCorrect" (boolean), "order" (number starting at 0)
- "category": string
- "difficulty": "EASY"|"MEDIUM"|"HARD"

Example output for type ${body.type}:
${typeExamples[body.type]}`

        const content = await openrouterChat(body.model, [{ role: 'user', content: prompt }])

        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('No JSON array found in response')
        const generated = JSON.parse(jsonMatch[0]) as any[]

        // Validate and fix structure per type
        const validated = generated.map((q: any) => {
          const answers: any[] = Array.isArray(q.answers) ? q.answers : []

          if (body.type === 'MULTIPLE_CHOICE') {
            // Ensure exactly 4 answers with exactly 1 correct
            const hasExact4 = answers.length === 4
            const correctCount = answers.filter((a: any) => a.isCorrect).length
            if (!hasExact4 || correctCount !== 1) {
              // Mark first answer correct, take/pad to 4
              const fixed = answers.slice(0, 4).map((a: any, i: number) => ({ ...a, isCorrect: i === 0, order: i }))
              while (fixed.length < 4) fixed.push({ text: `Option ${fixed.length + 1}`, isCorrect: false, order: fixed.length })
              q.answers = fixed
            }
          }

          return q
        })

        // Calculate points per question
        function calcPoints(q: any): number {
          if (body.type === 'MULTIPLE_ANSWER') {
            const m = (q.text as string).match(/name\s+(\d+)\s+of/i)
              || (q.text as string).match(/list\s+(\d+)\b/i)
              || (q.text as string).match(/give\s+(\d+)\b/i)
            if (m) return parseInt(m[1], 10)
            const correctCount = (q.answers ?? []).filter((a: any) => a.isCorrect).length
            return correctCount || 1
          }
          return 1
        }

        // Create staged questions
        const staged = await Promise.all(
          validated.map((q: any) =>
            prisma.stagedQuestion.create({
              data: {
                data: { ...q, type: body.type, points: calcPoints(q) },
                source: 'ai_generated',
                status: 'PENDING',
                aiNotes: `Generated by ${body.model}`,
              },
            })
          )
        )

        await prisma.aiTask.update({
          where: { id: task.id },
          data: { status: 'done', result: staged as any, completedAt: new Date() },
        })
      } catch (err: any) {
        await prisma.aiTask.update({
          where: { id: task.id },
          data: { status: 'failed', error: err.message, completedAt: new Date() },
        })
      }
    })()

    return c.json({ taskId: task.id, message: 'Generation started' }, 202)
  }
)

// AI QA: fill missing fields for a question
app.post(
  '/qa-fill/:questionId',
  zValidator('json', z.object({ model: z.string() })),
  async (c) => {
    if (!process.env.OPEN_ROUTER_API_KEY) {
      return c.json({ error: 'OPEN_ROUTER_API_KEY not configured' }, 503)
    }

    const question = await prisma.question.findUnique({
      where: { id: c.req.param('questionId') },
      include: { answers: true },
    })
    if (!question) return c.json({ error: 'Not found' }, 404)

    const { model } = c.req.valid('json')
    const task = await prisma.aiTask.create({
      data: { type: 'qa_fill', status: 'running', model, prompt: question.id },
    })

    ;(async () => {
      try {
        const prompt = `Given this trivia question, suggest values for any missing fields.
Question: "${question.text}"
Answers: ${question.answers.map(a => a.text).join(', ')}
Current category: ${question.category ?? 'MISSING'}
Current subCategory: ${question.subCategory ?? 'MISSING'}
Current difficulty: ${question.difficulty}

Respond with a JSON object with only the fields that need updating:
{"category": "...", "subCategory": "...", "difficulty": "EASY|MEDIUM|HARD"}`

        const content = await openrouterChat(model, [{ role: 'user', content: prompt }])
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found')
        const suggestions = JSON.parse(jsonMatch[0])

        await prisma.aiTask.update({
          where: { id: task.id },
          data: { status: 'done', result: suggestions, completedAt: new Date() },
        })
      } catch (err: any) {
        await prisma.aiTask.update({
          where: { id: task.id },
          data: { status: 'failed', error: err.message, completedAt: new Date() },
        })
      }
    })()

    return c.json({ taskId: task.id }, 202)
  }
)

// AI semantic duplicate check
app.post(
  '/semantic-duplicate',
  zValidator('json', z.object({ model: z.string(), questionId: z.string() })),
  async (c) => {
    if (!process.env.OPEN_ROUTER_API_KEY) {
      return c.json({ error: 'OPEN_ROUTER_API_KEY not configured' }, 503)
    }

    const { model, questionId } = c.req.valid('json')
    const question = await prisma.question.findUnique({ where: { id: questionId } })
    if (!question) return c.json({ error: 'Not found' }, 404)

    // Get candidates from traditional duplicate detection first
    const candidates = await runDuplicateDetection(question.text, questionId)
    if (candidates.length === 0) return c.json({ duplicates: [] })

    const task = await prisma.aiTask.create({
      data: { type: 'semantic_duplicate', status: 'running', model, prompt: questionId },
    })

    ;(async () => {
      try {
        const candidateTexts = candidates.slice(0, 10).map((c: any, i: number) =>
          `${i + 1}. [${c.id}] "${c.text}" (score: ${c.score})`
        ).join('\n')

        const prompt = `Are any of these trivia questions semantically equivalent to or duplicates of the target question?

Target: "${question.text}"

Candidates:
${candidateTexts}

Respond with JSON: {"duplicates": [{"id": "...", "reason": "..."}]}`

        const content = await openrouterChat(model, [{ role: 'user', content: prompt }])
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found')
        const result = JSON.parse(jsonMatch[0])

        await prisma.aiTask.update({
          where: { id: task.id },
          data: { status: 'done', result, completedAt: new Date() },
        })
      } catch (err: any) {
        await prisma.aiTask.update({
          where: { id: task.id },
          data: { status: 'failed', error: err.message, completedAt: new Date() },
        })
      }
    })()

    return c.json({ taskId: task.id }, 202)
  }
)

export default app
