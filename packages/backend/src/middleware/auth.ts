import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'change-me')

  try {
    const { payload } = await jwtVerify(token, secret)
    c.set('jwtPayload', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
})
