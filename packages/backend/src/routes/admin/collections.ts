import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/prisma.js'

const app = new Hono()

const collectionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

app.get('/', async (c) => {
  const collections = await prisma.collection.findMany({ orderBy: { name: 'asc' } })
  return c.json(collections)
})

app.post('/', zValidator('json', collectionSchema), async (c) => {
  const data = c.req.valid('json')
  const collection = await prisma.collection.create({ data })
  return c.json(collection, 201)
})

app.put('/:id', zValidator('json', collectionSchema.partial()), async (c) => {
  const collection = await prisma.collection.update({
    where: { id: c.req.param('id') },
    data: c.req.valid('json'),
  })
  return c.json(collection)
})

app.delete('/:id', async (c) => {
  await prisma.collection.delete({ where: { id: c.req.param('id') } }).catch(() => null)
  return c.json({ success: true })
})

export default app
