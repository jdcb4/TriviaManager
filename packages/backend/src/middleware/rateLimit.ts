import { rateLimiter } from 'hono-rate-limiter'

export const publicRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-6',
  keyGenerator: (c) =>
    c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
})
