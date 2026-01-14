import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Rate limiting configuration
// Dashboard makes many parallel requests:
// - AllResourcesView: parallel requests for each kind (20+ kinds possible)
// - Each kind: resources + capabilities = 2 requests
// - Plus: namespaces, resource kinds for sidebar
// Conservative estimate: 50+ requests per page load
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

const staticLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute per IP for static files
  standardHeaders: true,
  legacyHeaders: false,
})
const isDev = process.env.NODE_ENV !== 'production'
const PORT = process.env.PORT || 3000
const MCP_BASE_URL = process.env.DOT_AI_MCP_URL || 'http://localhost:8080'
const AUTH_TOKEN = process.env.DOT_AI_AUTH_TOKEN
const API_TIMEOUT = 5 * 60 * 1000 // 5 minutes for AI generation

console.log(`[Config] MCP_BASE_URL: ${MCP_BASE_URL}`)
console.log(`[Config] AUTH_TOKEN: ${AUTH_TOKEN ? '***set***' : 'NOT SET'}`)

async function createServer() {
  const app = express()

  // Log ALL incoming requests
  app.use((req, _res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`)
    next()
  })

  app.use(express.json())

  // Debug endpoint
  app.get('/api/debug', (_req, res) => {
    console.log('[Debug] Hit debug endpoint')
    res.json({ ok: true, mcp: MCP_BASE_URL, hasToken: !!AUTH_TOKEN })
  })

  // Proxy visualization API requests to MCP server
  app.get('/api/v1/visualize/:sessionId', apiLimiter, async (req, res) => {
    const { sessionId } = req.params

    // Validate sessionId format to prevent path injection (SSRF)
    // Allows + for multi-session IDs (e.g., id1+id2+id3)
    if (!/^[a-zA-Z0-9_+-]+$/.test(sessionId)) {
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

      const startTime = Date.now()
      const queryString = new URLSearchParams(req.query as Record<string, string>).toString()
      const url = `${MCP_BASE_URL}/api/v1/visualize/${sessionId}${queryString ? `?${queryString}` : ''}`
      console.log(`[Proxy] Fetching from MCP: ${url}`)
      console.log(`[Proxy] Headers:`, JSON.stringify(headers))

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[Proxy] MCP response in ${elapsed}s (status: ${response.status})`)

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

  // Proxy dashboard resource list API requests to MCP server
  app.get('/api/v1/resources', apiLimiter, async (req, res) => {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const queryString = new URLSearchParams(req.query as Record<string, string>).toString()
      const url = `${MCP_BASE_URL}/api/v1/resources${queryString ? `?${queryString}` : ''}`
      console.log(`[Proxy] Fetching resources from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch resources' })
    }
  })

  // Proxy dashboard namespaces API requests to MCP server
  app.get('/api/v1/namespaces', apiLimiter, async (_req, res) => {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const url = `${MCP_BASE_URL}/api/v1/namespaces`
      console.log(`[Proxy] Fetching namespaces from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch namespaces' })
    }
  })

  // Proxy capabilities API requests to MCP server
  // Used to get printer columns for dynamic table columns
  // MCP uses POST /api/v1/tools/manageOrgData with JSON body
  app.get('/api/v1/capabilities', apiLimiter, async (req, res) => {
    try {
      const { kind, apiVersion } = req.query as { kind?: string; apiVersion?: string }

      if (!kind || !apiVersion) {
        return res.status(400).json({ error: 'Missing required parameters: kind, apiVersion' })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const url = `${MCP_BASE_URL}/api/v1/tools/manageOrgData`
      const body = {
        dataType: 'capabilities',
        operation: 'get',
        id: JSON.stringify({ kind, apiVersion }),
      }

      console.log(`[Proxy] Fetching capabilities from MCP: ${url}`)
      console.log(`[Proxy] Body: ${JSON.stringify(body)}`)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
      res.status(500).json({ error: 'Failed to fetch capabilities' })
    }
  })

  // Proxy single resource API request to MCP server
  // Used to get full resource data (metadata, spec, status) for detail views
  app.get('/api/v1/resource', apiLimiter, async (req, res) => {
    try {
      const { kind, apiVersion, name, namespace } = req.query as {
        kind?: string
        apiVersion?: string
        name?: string
        namespace?: string
      }

      if (!kind || !apiVersion || !name) {
        return res
          .status(400)
          .json({ error: 'Missing required parameters: kind, apiVersion, name' })
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const queryParams = new URLSearchParams({ kind, apiVersion, name })
      if (namespace) {
        queryParams.set('namespace', namespace)
      }

      const url = `${MCP_BASE_URL}/api/v1/resource?${queryParams}`
      console.log(`[Proxy] Fetching single resource from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch resource' })
    }
  })

  // Proxy events API request to MCP server
  // MCP handles filtering by involvedObject fields via field-selectors
  app.get('/api/v1/events', apiLimiter, async (req, res) => {
    try {
      const { namespace, name, kind, uid } = req.query as {
        namespace?: string
        name?: string
        kind?: string
        uid?: string
      }

      if (!name || !kind) {
        return res
          .status(400)
          .json({ error: 'Missing required parameters: name, kind' })
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      // Build query params for MCP's /api/v1/events endpoint
      const queryParams = new URLSearchParams({ name, kind })
      if (namespace) {
        queryParams.set('namespace', namespace)
      }
      if (uid) {
        queryParams.set('uid', uid)
      }

      const url = `${MCP_BASE_URL}/api/v1/events?${queryParams}`
      console.log(`[Proxy] Fetching events from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch events' })
    }
  })

  // Proxy pod logs API request to MCP server
  app.get('/api/v1/logs', apiLimiter, async (req, res) => {
    try {
      const { namespace, name, container, tailLines } = req.query as {
        namespace?: string
        name?: string
        container?: string
        tailLines?: string
      }

      if (!name || !namespace) {
        return res
          .status(400)
          .json({ error: 'Missing required parameters: name, namespace' })
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout for logs

      // Build query params for MCP's /api/v1/logs endpoint
      const queryParams = new URLSearchParams({ name, namespace })
      if (container) {
        queryParams.set('container', container)
      }
      if (tailLines) {
        queryParams.set('tailLines', tailLines)
      }

      const url = `${MCP_BASE_URL}/api/v1/logs?${queryParams}`
      console.log(`[Proxy] Fetching logs from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch logs' })
    }
  })

  // Proxy Query tool API requests to MCP server
  // Used for AI-powered cluster analysis with inline visualization mode
  app.post('/api/v1/tools/query', apiLimiter, async (req, res) => {
    try {
      const { intent } = req.body as { intent?: string }

      if (!intent) {
        return res.status(400).json({ error: 'Missing required parameter: intent' })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      // 30 minute timeout for complex AI queries
      const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000)

      const url = `${MCP_BASE_URL}/api/v1/tools/query`
      console.log(`[Proxy] Sending query to MCP: ${url}`)
      console.log(`[Proxy] Intent: ${intent.substring(0, 100)}...`)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ intent }),
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Query timeout')
        return res.status(408).json({ error: 'Query timeout - request took too long' })
      }
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to execute query' })
    }
  })

  // Proxy Remediate tool API requests to MCP server
  // Multi-step workflow: analysis → user decision → execution
  app.post('/api/v1/tools/remediate', apiLimiter, async (req, res) => {
    try {
      const { issue, sessionId, executeChoice } = req.body as {
        issue?: string
        sessionId?: string
        executeChoice?: number
      }

      // Either issue (step 1) or sessionId + executeChoice (step 2) required
      if (!issue && !sessionId) {
        return res.status(400).json({ error: 'Missing required parameter: issue or sessionId' })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      // 30 minute timeout for complex AI analysis
      const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000)

      const url = `${MCP_BASE_URL}/api/v1/tools/remediate`
      const body = sessionId ? { sessionId, executeChoice } : { issue }
      console.log(`[Proxy] Sending remediate to MCP: ${url}`)
      console.log(`[Proxy] Body: ${JSON.stringify(body).substring(0, 200)}...`)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Remediate timeout')
        return res.status(408).json({ error: 'Remediate timeout - request took too long' })
      }
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to execute remediate' })
    }
  })

  // Proxy Operate tool API requests to MCP server
  // Multi-step workflow: analysis → user approval → execution
  // Used for Day 2 operations: scale, update, rollback, etc.
  app.post('/api/v1/tools/operate', apiLimiter, async (req, res) => {
    try {
      const { intent, sessionId, executeChoice } = req.body as {
        intent?: string
        sessionId?: string
        executeChoice?: number
      }

      // Either intent (step 1) or sessionId + executeChoice (step 2) required
      if (!intent && !sessionId) {
        return res.status(400).json({ error: 'Missing required parameter: intent or sessionId' })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      // 30 minute timeout for complex AI operations
      const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000)

      const url = `${MCP_BASE_URL}/api/v1/tools/operate`
      const body = sessionId ? { sessionId, executeChoice } : { intent }
      console.log(`[Proxy] Sending operate to MCP: ${url}`)
      console.log(`[Proxy] Body: ${JSON.stringify(body).substring(0, 200)}...`)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Operate timeout')
        return res.status(408).json({ error: 'Operate timeout - request took too long' })
      }
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to execute operate' })
    }
  })

  // Proxy Recommend tool API requests to MCP server
  // Multi-stage workflow: intent → solutions → questions → manifests → deploy
  // Used for AI-powered deployment recommendations
  app.post('/api/v1/tools/recommend', apiLimiter, async (req, res) => {
    try {
      const { intent, final, stage, solutionId, answers, timeout } = req.body as {
        intent?: string
        final?: boolean
        stage?: string
        solutionId?: string
        answers?: Record<string, string | number>
        timeout?: number
      }

      // Validate request: either intent (initial) or stage + solutionId (subsequent stages)
      if (!intent && !stage) {
        return res.status(400).json({ error: 'Missing required parameter: intent or stage' })
      }
      if (stage && !solutionId) {
        return res.status(400).json({ error: 'Missing required parameter: solutionId for stage operations' })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      // 30 minute timeout for complex AI operations
      const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000)

      const url = `${MCP_BASE_URL}/api/v1/tools/recommend`

      // Build body based on the stage of the workflow
      let body: Record<string, unknown>
      if (intent) {
        // Initial intent submission
        body = { intent }
        if (final) {
          body.final = true
        }
      } else {
        // Stage-based operations
        body = { stage, solutionId }
        if (answers) {
          body.answers = answers
        }
        if (timeout) {
          body.timeout = timeout
        }
      }

      console.log(`[Proxy] Sending recommend to MCP: ${url}`)
      console.log(`[Proxy] Body: ${JSON.stringify(body).substring(0, 200)}...`)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Recommend timeout')
        return res.status(408).json({ error: 'Recommend timeout - request took too long' })
      }
      console.error('Proxy error:', error)
      res.status(500).json({ error: 'Failed to execute recommend' })
    }
  })

  // Proxy session retrieval API requests to MCP server
  // Generic endpoint for retrieving any session data (remediate, query, etc.)
  app.get('/api/v1/sessions/:sessionId', apiLimiter, async (req, res) => {
    const { sessionId } = req.params

    // Validate sessionId format to prevent path injection
    if (!/^[a-zA-Z0-9_+-]+$/.test(sessionId)) {
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
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const url = `${MCP_BASE_URL}/api/v1/sessions/${sessionId}`
      console.log(`[Proxy] Fetching session from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch session data' })
    }
  })

  // Proxy dashboard resource kinds API requests to MCP server
  app.get('/api/v1/resources/kinds', apiLimiter, async (req, res) => {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (AUTH_TOKEN) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const queryString = new URLSearchParams(req.query as Record<string, string>).toString()
      const url = `${MCP_BASE_URL}/api/v1/resources/kinds${queryString ? `?${queryString}` : ''}`
      console.log(`[Proxy] Fetching resource kinds from MCP: ${url}`)

      const response = await fetch(url, {
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
      res.status(500).json({ error: 'Failed to fetch resource kinds' })
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
