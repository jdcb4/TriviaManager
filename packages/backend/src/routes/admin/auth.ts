import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const app = new Hono()

app.post(
  '/login',
  zValidator('json', z.object({ password: z.string() })),
  async (c) => {
    const { password } = c.req.valid('json')
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword || password !== adminPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'change-me')
    const token = await new SignJWT({ admin: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)

    return c.json({ token })
  }
)

export default app
