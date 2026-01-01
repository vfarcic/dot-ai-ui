import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

const staticLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP for static files
  standardHeaders: true,
  legacyHeaders: false,
})
const isDev = process.env.NODE_ENV !== 'production'
const PORT = process.env.PORT || 3000
const MCP_BASE_URL = process.env.DOT_AI_MCP_URL || 'http://localhost:8080'
const AUTH_TOKEN = process.env.DOT_AI_AUTH_TOKEN
const API_TIMEOUT = 5 * 60 * 1000 // 5 minutes for AI generation

async function createServer() {
  const app = express()

  app.use(express.json())

  // Proxy visualization API requests to MCP server
  app.get('/api/v1/visualize/:sessionId', apiLimiter, async (req, res) => {
    const { sessionId } = req.params

    // Validate sessionId format to prevent path injection (SSRF)
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID format' })
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

      const response = await fetch(`${MCP_BASE_URL}/api/v1/visualize/${sessionId}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      let data
      try {
        data = await response.json()
      } catch {
        return res.status(502).json({ error: 'Invalid response from upstream server' })
      }

      if (!response.ok) {
        return res.status(response.status).json(data)
      }

      res.json(data)
    } catch (error) {
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to fetch visualization data' })
    }
  })

  if (isDev) {
    // Development: use Vite middleware for HMR
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    // Production: serve static files
    app.use(express.static(path.join(__dirname, '../dist')))

    // Handle SPA routing - catch all unmatched routes
    app.use(staticLimiter, (_req, res) => {
      res.sendFile(path.join(__dirname, '../dist/index.html'))
    })
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

createServer()
