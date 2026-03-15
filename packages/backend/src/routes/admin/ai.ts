import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'
import { openrouterChat } from '../../services/openrouter.js'
import { runDuplicateDetection } from '../../services/duplicateDetection.js'

const app = new Hono()

type ModelInfo = { id: string; name: string; category: string; cost: string; provider: string }

const MODEL_CATALOG: ModelInfo[] = [
  // Frontier
  { id: 'anthropic/claude-opus-4.6',     name: 'Claude Opus 4.6',        category: 'Frontier', cost: '$25/1M',   provider: 'Anthropic' },
  { id: 'openai/gpt-5.4',                name: 'GPT-5.4',                category: 'Frontier', cost: '$15/1M',   provider: 'OpenAI'    },
  { id: 'google/gemini-3-pro-preview',   name: 'Gemini 3 Pro Preview',   category: 'Frontier', cost: '$12/1M',   provider: 'Google'    },
  // Balanced
  { id: 'anthropic/claude-sonnet-4.6',   name: 'Claude Sonnet 4.6',      category: 'Balanced', cost: '$15/1M',   provider: 'Anthropic' },
  { id: 'anthropic/claude-sonnet-4.5',   name: 'Claude Sonnet 4.5',      category: 'Balanced', cost: '$15/1M',   provider: 'Anthropic' },
  { id: 'moonshotai/kimi-k2.5',          name: 'Kimi K2.5',              category: 'Balanced', cost: '$2.20/1M', provider: 'MoonshotAI'},
  { id: 'openai/gpt-oss-120b',           name: 'GPT-OSS 120B',           category: 'Balanced', cost: '~$2/1M',   provider: 'OpenAI'    },
  { id: 'x-ai/grok-4.1-fast',           name: 'Grok 4.1 Fast',          category: 'Balanced', cost: '$0.50/1M', provider: 'X-AI'      },
  // Speed
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', category: 'Speed',    cost: '$3/1M',    provider: 'Google'    },
  { id: 'google/gemini-2.5-flash',       name: 'Gemini 2.5 Flash',       category: 'Speed',    cost: '$2.50/1M', provider: 'Google'    },
  { id: 'google/gemini-2.5-flash-lite',  name: 'Gemini 2.5 Flash Lite',  category: 'Speed',    cost: '$0.40/1M', provider: 'Google'    },
  { id: 'minimax/minimax-m2.5',          name: 'MiniMax M2.5',           category: 'Speed',    cost: '$0.95/1M', provider: 'MiniMax'   },
  { id: 'openai/gpt-5-nano',             name: 'GPT-5 Nano',             category: 'Speed',    cost: '$0.40/1M', provider: 'OpenAI'    },
  // Budget
  { id: 'deepseek/deepseek-v3.2',        name: 'DeepSeek V3.2',          category: 'Budget',   cost: '$0.38/1M', provider: 'DeepSeek'  },
  { id: 'qwen/qwen3.5-plus-02-15',       name: 'Qwen3.5 Plus',           category: 'Budget',   cost: '$1.56/1M', provider: 'Qwen'      },
  { id: 'qwen/qwen3.5-flash-02-23',      name: 'Qwen3.5 Flash',          category: 'Budget',   cost: '$0.40/1M', provider: 'Qwen'      },
  { id: 'z-ai/glm-5',                    name: 'Z.AI GLM-5',             category: 'Budget',   cost: '$2.30/1M', provider: 'Z.AI'      },
]

app.get('/models', async (c) => {
  return c.json(MODEL_CATALOG)
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
    type: z.enum(['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER']).optional(),
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
          STANDARD: `{"text":"What is the capital of France?","type":"STANDARD","answers":[{"text":"Paris","isCorrect":true,"order":0}],"category":"Geography","difficulty":"EASY"}`,
          MULTIPLE_CHOICE: `{"text":"Which planet is the largest in our solar system?","type":"MULTIPLE_CHOICE","answers":[{"text":"Jupiter","isCorrect":true,"order":0},{"text":"Saturn","isCorrect":false,"order":1},{"text":"Neptune","isCorrect":false,"order":2},{"text":"Mars","isCorrect":false,"order":3}],"category":"Science","difficulty":"EASY"}`,
          MULTIPLE_ANSWER: `{"text":"Name 3 of the 5 oceans on Earth.","type":"MULTIPLE_ANSWER","answers":[{"text":"Pacific","isCorrect":true,"order":0},{"text":"Atlantic","isCorrect":true,"order":1},{"text":"Indian","isCorrect":true,"order":2},{"text":"Arctic","isCorrect":true,"order":3},{"text":"Southern","isCorrect":true,"order":4}],"category":"Geography","difficulty":"MEDIUM"}`,
        }

        const isMixed = !body.type

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

        const typeSection = isMixed
          ? `QUESTION TYPES: Mixed — freely choose the best type for each question.
Each question MUST include a "type" field set to one of: "STANDARD", "MULTIPLE_CHOICE", "MULTIPLE_ANSWER".

STANDARD: ${typeInstructions.STANDARD}

MULTIPLE_CHOICE: ${typeInstructions.MULTIPLE_CHOICE}

MULTIPLE_ANSWER: ${typeInstructions.MULTIPLE_ANSWER}`
          : `QUESTION TYPE: ${body.type}
${typeInstructions[body.type]}`

        const exampleSection = isMixed
          ? `Example objects (one per type):
[${typeExamples.STANDARD}, ${typeExamples.MULTIPLE_CHOICE}, ${typeExamples.MULTIPLE_ANSWER}]`
          : `Example output for type ${body.type}:
[${typeExamples[body.type]}]`

        const prompt = `Generate exactly ${body.count} trivia questions${body.category ? ` about ${body.category}` : ''} at ${body.difficulty ?? 'MEDIUM'} difficulty.

${typeSection}
${body.instructions ? `\nAdditional instructions: ${body.instructions}` : ''}

VARIETY (seed ${seed}): ${randomHint} Generate diverse questions — avoid repeating the same subject or answer across the batch.

Respond ONLY with a valid JSON array. Each element must have:
- "text": the question text
- "type": "STANDARD"|"MULTIPLE_CHOICE"|"MULTIPLE_ANSWER"
- "answers": array of objects with "text" (string), "isCorrect" (boolean), "order" (number starting at 0)
- "category": string
- "difficulty": "EASY"|"MEDIUM"|"HARD"

${exampleSection}`

        const content = await openrouterChat(body.model, [{ role: 'user', content: prompt }])

        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('No JSON array found in response')
        const generated = JSON.parse(jsonMatch[0]) as any[]

        // Validate and fix structure per question type
        const validated = generated.map((q: any) => {
          const qType: string = isMixed
            ? (['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER'].includes(q.type) ? q.type : 'STANDARD')
            : body.type!
          const answers: any[] = Array.isArray(q.answers) ? q.answers : []

          if (qType === 'MULTIPLE_CHOICE') {
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

          return { ...q, type: qType }
        })

        // Calculate points per question based on its own type
        function calcPoints(q: any): number {
          if (q.type === 'MULTIPLE_ANSWER') {
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
                data: { ...q, points: calcPoints(q) },
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
