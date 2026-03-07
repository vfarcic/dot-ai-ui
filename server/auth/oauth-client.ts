import crypto from 'crypto'

const MCP_BASE_URL = process.env.DOT_AI_MCP_URL || 'http://localhost:8080'

// Registered client credentials (populated by registerClient)
let clientId: string | null = null
let clientSecret: string | null = null
let registeredCallbackUrl: string | null = null

// Pending authorization requests: state → { codeVerifier, redirectUri }
const pendingAuths = new Map<
  string,
  { codeVerifier: string; createdAt: number }
>()

// Clean up expired pending auths every 5 minutes
const PENDING_AUTH_TTL_MS = 10 * 60 * 1000 // 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [state, pending] of pendingAuths) {
    if (now - pending.createdAt > PENDING_AUTH_TTL_MS) {
      pendingAuths.delete(state)
    }
  }
}, 5 * 60 * 1000)

/**
 * Register this UI as an OAuth client with the dot-ai server (RFC 7591).
 * Called once on startup. Stores client_id and client_secret in memory.
 */
export async function registerClient(callbackUrl: string): Promise<void> {
  const body = {
    redirect_uris: [callbackUrl],
    client_name: 'dot-ai-ui',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  }

  console.log(`[OAuth] Registering client at ${MCP_BASE_URL}/register`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  const res = await fetch(`${MCP_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(
      `OAuth client registration failed (${res.status}): ${text}`
    )
  }

  const data = await res.json()
  clientId = data.client_id
  clientSecret = data.client_secret || null

  registeredCallbackUrl = callbackUrl
  console.log(`[OAuth] Client registered: ${clientId}`)
}

/**
 * Check if OAuth client is registered and ready
 */
export function isOAuthReady(): boolean {
  return clientId !== null
}

/**
 * Get the callback URL used during client registration.
 * All OAuth operations must use this exact URL to avoid redirect_uri_mismatch.
 */
export function getRegisteredCallbackUrl(): string {
  if (!registeredCallbackUrl) {
    throw new Error('OAuth client not registered')
  }
  return registeredCallbackUrl
}

/**
 * Generate a PKCE code verifier and challenge
 */
function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  // RFC 7636: code_verifier is 43-128 characters from [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return { codeVerifier, codeChallenge }
}

/**
 * Build the authorization URL and store PKCE verifier for later exchange.
 * Returns the URL to redirect the browser to.
 */
export function buildAuthorizeUrl(): string {
  if (!clientId || !registeredCallbackUrl) {
    throw new Error('OAuth client not registered')
  }

  const state = crypto.randomBytes(16).toString('hex')
  const { codeVerifier, codeChallenge } = generatePkce()

  // Store verifier for the callback
  pendingAuths.set(state, {
    codeVerifier,
    createdAt: Date.now(),
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: registeredCallbackUrl,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  return `${MCP_BASE_URL}/authorize?${params}`
}

/**
 * Exchange an authorization code for an access token.
 * Validates the state parameter and uses the stored PKCE verifier.
 */
export async function exchangeCode(
  code: string,
  state: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!clientId || !registeredCallbackUrl) {
    throw new Error('OAuth client not registered')
  }

  const pending = pendingAuths.get(state)
  if (!pending) {
    throw new Error('Invalid or expired state parameter')
  }

  // Remove the pending auth (one-time use)
  pendingAuths.delete(state)

  // Check expiry
  if (Date.now() - pending.createdAt > PENDING_AUTH_TTL_MS) {
    throw new Error('Authorization request expired')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: registeredCallbackUrl,
    client_id: clientId,
    code_verifier: pending.codeVerifier,
  })

  if (clientSecret) {
    body.set('client_secret', clientSecret)
  }

  const tokenController = new AbortController()
  const tokenTimeoutId = setTimeout(() => tokenController.abort(), 30000)

  const res = await fetch(`${MCP_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: tokenController.signal,
  })

  clearTimeout(tokenTimeoutId)

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  }
}

