import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock OpenAI constructor (must be hoisted for Vitest)
// ---------------------------------------------------------------------------
const OpenAIMock = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: OpenAIMock,
}))

import { LiteLLMAdapter } from '../src/llm/litellm.js'
import { createAdapter } from '../src/llm/adapter.js'

// ---------------------------------------------------------------------------
// LiteLLMAdapter tests
// ---------------------------------------------------------------------------

describe('LiteLLMAdapter', () => {
  beforeEach(() => {
    OpenAIMock.mockClear()
  })

  it('has name "litellm"', () => {
    const adapter = new LiteLLMAdapter()
    expect(adapter.name).toBe('litellm')
  })

  it('uses LITELLM_API_KEY env var when set', () => {
    const original = process.env['LITELLM_API_KEY']
    process.env['LITELLM_API_KEY'] = 'litellm-test-key-123'

    try {
      new LiteLLMAdapter()
      expect(OpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'litellm-test-key-123',
          baseURL: 'http://localhost:4000',
        })
      )
    } finally {
      if (original === undefined) {
        delete process.env['LITELLM_API_KEY']
      } else {
        process.env['LITELLM_API_KEY'] = original
      }
    }
  })

  it('falls back to placeholder key and localhost baseURL by default', () => {
    const originalKey = process.env['LITELLM_API_KEY']
    const originalUrl = process.env['LITELLM_BASE_URL']
    delete process.env['LITELLM_API_KEY']
    delete process.env['LITELLM_BASE_URL']

    try {
      new LiteLLMAdapter()
      expect(OpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'litellm',
          baseURL: 'http://localhost:4000',
        })
      )
    } finally {
      if (originalKey !== undefined) process.env['LITELLM_API_KEY'] = originalKey
      if (originalUrl !== undefined) process.env['LITELLM_BASE_URL'] = originalUrl
    }
  })

  it('uses LITELLM_BASE_URL env var when set', () => {
    const original = process.env['LITELLM_BASE_URL']
    process.env['LITELLM_BASE_URL'] = 'https://my-litellm-proxy.example.com'

    try {
      new LiteLLMAdapter('some-key')
      expect(OpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'some-key',
          baseURL: 'https://my-litellm-proxy.example.com',
        })
      )
    } finally {
      if (original === undefined) {
        delete process.env['LITELLM_BASE_URL']
      } else {
        process.env['LITELLM_BASE_URL'] = original
      }
    }
  })

  it('allows overriding apiKey and baseURL via constructor', () => {
    new LiteLLMAdapter('custom-key', 'http://remote-proxy:8080')
    expect(OpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'custom-key',
        baseURL: 'http://remote-proxy:8080',
      })
    )
  })

  it('createAdapter("litellm") returns LiteLLMAdapter instance', async () => {
    const adapter = await createAdapter('litellm')
    expect(adapter).toBeInstanceOf(LiteLLMAdapter)
  })
})
