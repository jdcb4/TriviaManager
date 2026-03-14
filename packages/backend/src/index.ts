import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { authMiddleware } from './middleware/auth.js'
import { publicRateLimit } from './middleware/rateLimit.js'

import publicQuestionsRouter from './routes/public/questions.js'
import downloadsRouter from './routes/public/downloads.js'
import adminAuthRouter from './routes/admin/auth.js'
import adminQuestionsRouter from './routes/admin/questions.js'
import adminCollectionsRouter from './routes/admin/collections.js'
import adminStagingRouter from './routes/admin/staging.js'
import adminFeedbackRouter, { publicFeedbackRouter } from './routes/admin/feedback.js'
import adminVersionsRouter, { publicVersionRouter } from './routes/admin/versions.js'
import adminAiRouter from './routes/admin/ai.js'
import adminIngestionRouter from './routes/admin/ingestion.js'
import adminSettingsRouter from './routes/admin/settings.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))
app.use('*', prettyJSON())

// Public API (rate limited)
app.use('/api/questions/*', publicRateLimit)
app.use('/api/downloads/*', publicRateLimit)
app.use('/api/dataset-version', publicRateLimit)

app.route('/api/questions', publicQuestionsRouter)
app.route('/api/downloads', downloadsRouter)
app.route('/api/dataset-version', publicVersionRouter)
app.route('/api/feedback', publicFeedbackRouter)

// Admin auth (no auth middleware on login itself)
app.route('/api/admin/auth', adminAuthRouter)

// Admin routes (all protected)
app.use('/api/admin/*', authMiddleware)
app.route('/api/admin/questions', adminQuestionsRouter)
app.route('/api/admin/collections', adminCollectionsRouter)
app.route('/api/admin/staging', adminStagingRouter)
app.route('/api/admin/feedback', adminFeedbackRouter)
app.route('/api/admin/versions', adminVersionsRouter)
app.route('/api/admin/ai', adminAiRouter)
app.route('/api/admin/ingestion', adminIngestionRouter)
app.route('/api/admin/settings', adminSettingsRouter)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Serve React SPA in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './public' }))
  app.get('*', serveStatic({ path: './public/index.html' }))
}

const port = parseInt(process.env.PORT ?? '3000', 10)
console.log(`Starting server on port ${port}`)

serve({ fetch: app.fetch, port })
