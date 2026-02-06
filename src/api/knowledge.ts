/**
 * Knowledge Base API Client
 * Provides AI-synthesized answers from ingested organizational documentation
 */

import { fetchWithAuth } from './authHeaders'

const API_PATH = '/api/v1'
const KNOWLEDGE_TIMEOUT = 5 * 60 * 1000 // 5 minutes for AI synthesis

export type SearchScope = 'resources' | 'knowledge' | 'both'

export interface AskKnowledgeParams {
  query: string
  limit?: number
  uriFilter?: string
  signal?: AbortSignal
}

export interface KnowledgeSource {
  uri: string
  title: string
}

export interface KnowledgeChunk {
  content: string
  uri: string
  score: number
  chunkIndex: number
}

export interface KnowledgeAnswer {
  answer: string
  sources: KnowledgeSource[]
  chunks: KnowledgeChunk[]
}

/**
 * Ask the Knowledge Base a question
 * Returns an AI-synthesized answer with source provenance and raw chunks
 */
export async function askKnowledge(params: AskKnowledgeParams): Promise<KnowledgeAnswer> {
  const { query, limit, uriFilter, signal: externalSignal } = params

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), KNOWLEDGE_TIMEOUT)

  // Abort internal controller when external signal fires
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  try {
    const body: Record<string, unknown> = { query }
    if (limit !== undefined) body.limit = limit
    if (uriFilter) body.uriFilter = uriFilter

    const response = await fetchWithAuth(`${API_PATH}/knowledge/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const json = await response.json()

    if (!response.ok) {
      const errorMessage = json.error?.message || json.error || `Request failed: ${response.status}`
      const errorCode = json.error?.code || ''
      throw new KnowledgeError(errorMessage, response.status, errorCode)
    }

    return {
      answer: json.data?.answer || '',
      sources: json.data?.sources || [],
      chunks: json.data?.chunks || [],
    }
  } catch (err) {
    if (err instanceof KnowledgeError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new KnowledgeError('Request timed out', 408, 'TIMEOUT')
    }
    throw new KnowledgeError(
      err instanceof Error ? err.message : 'Failed to connect to server',
      0,
      'NETWORK'
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export class KnowledgeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message)
    this.name = 'KnowledgeError'
  }
}
