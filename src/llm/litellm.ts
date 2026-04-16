/**
 * @fileoverview LiteLLM proxy adapter.
 *
 * Thin wrapper around OpenAIAdapter that defaults to the LiteLLM proxy
 * endpoint (http://localhost:4000) and LITELLM_API_KEY / LITELLM_BASE_URL
 * environment variable fallbacks.
 *
 * LiteLLM is an OpenAI-compatible proxy that routes requests to 100+ LLMs
 * (Anthropic, Bedrock, Vertex, Hugging Face, Cohere, etc.) using a unified
 * interface. Run it locally with `litellm --model <provider>/<model>` or point
 * at a remote LiteLLM deployment by setting LITELLM_BASE_URL.
 */

import { OpenAIAdapter } from './openai.js'

/**
 * LLM adapter for LiteLLM proxy.
 *
 * Thread-safe. Can be shared across agents.
 *
 * Usage:
 *   provider: 'litellm'
 *   model: '<any model name configured in your LiteLLM proxy>'
 *
 * The model name must match an entry in your LiteLLM proxy config (e.g.
 * 'gpt-4o', 'claude-3-5-sonnet-20241022', 'ollama/llama3', etc.).
 *
 * For a local unsecured proxy, any non-empty string works as apiKey ('litellm'
 * is used as a safe placeholder when LITELLM_API_KEY is not set).
 */
export class LiteLLMAdapter extends OpenAIAdapter {
  readonly name = 'litellm'

  constructor(apiKey?: string, baseURL?: string) {
    super(
      // Use explicit key → env var → placeholder (local proxy requires any non-empty string)
      apiKey ?? process.env['LITELLM_API_KEY'] ?? 'litellm',
      // Use explicit URL → env var → default local proxy address
      baseURL ?? process.env['LITELLM_BASE_URL'] ?? 'http://localhost:4000'
    )
  }
}
