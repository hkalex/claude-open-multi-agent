/**
 * Example 19 — Multi-Agent Team Collaboration with LiteLLM Proxy
 *
 * Three specialized agents (architect, developer, reviewer) collaborate via `runTeam()`
 * to build a minimal Express.js REST API. Every agent routes through a local LiteLLM
 * proxy, which can be backed by any model your proxy is configured for.
 *
 * Run:
 *   npx tsx examples/19-litellm.ts
 *
 * Important:
 *   Setting up and configuring LiteLLM is done separately and is NOT included
 *   in this library or example. You must install, configure, and run the LiteLLM
 *   proxy yourself before running this script.
 *   See https://www.litellm.ai/ for full setup documentation.
 *
 * Required environment variables:
 *   LITELLM_BASE_URL  — address of your LiteLLM proxy (e.g. http://localhost:4000)
 *   LITELLM_API_KEY   — API key configured in your LiteLLM proxy
 *
 * Model name:
 *   The 'model' field must match a model alias configured in your LiteLLM proxy
 *   (e.g. 'gpt-4o', 'claude-3-5-sonnet-20241022', 'ollama/llama3', etc.).
 *   This example uses 'gpt-4o' as a common default.
 */

import { OpenMultiAgent } from '../src/index.js'
import type { AgentConfig, OrchestratorEvent } from '../src/types.js'

// The model name must match an alias defined in your LiteLLM proxy config.
const LITELLM_MODEL = process.env['LITELLM_MODEL'] ?? 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Agent definitions (all routing through the LiteLLM proxy)
// ---------------------------------------------------------------------------
const architect: AgentConfig = {
  name: 'architect',
  model: 'claude-opus-4-6', // The model name must match an alias defined in your LiteLLM proxy config.
  provider: 'litellm',
  systemPrompt: `You are a software architect with deep experience in Node.js and REST API design.
Your job is to design clear, production-quality API contracts and file/directory structures.
Output concise plans in markdown — no unnecessary prose.`,
  tools: ['bash', 'file_write'],
  maxTurns: 5,
  temperature: 0.2,
}

const developer: AgentConfig = {
  name: 'developer',
  model: LITELLM_MODEL,
  provider: 'litellm',
  systemPrompt: `You are a TypeScript/Node.js developer. You implement what the architect specifies.
Write clean, runnable code with proper error handling. Use the tools to write files and run tests.`,
  tools: ['bash', 'file_read', 'file_write', 'file_edit'],
  maxTurns: 12,
  temperature: 0.1,
}

const reviewer: AgentConfig = {
  name: 'reviewer',
  model: LITELLM_MODEL,
  provider: 'litellm',
  systemPrompt: `You are a senior code reviewer. Review code for correctness, security, and clarity.
Provide a structured review with: LGTM items, suggestions, and any blocking issues.
Read files using the tools before reviewing.`,
  tools: ['bash', 'file_read', 'grep'],
  maxTurns: 5,
  temperature: 0.3,
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------
const startTimes = new Map<string, number>()

function handleProgress(event: OrchestratorEvent): void {
  const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  switch (event.type) {
    case 'agent_start':
      startTimes.set(event.agent ?? '', Date.now())
      console.log(`[${ts}] AGENT START → ${event.agent}`)
      break
    case 'agent_complete': {
      const elapsed = Date.now() - (startTimes.get(event.agent ?? '') ?? Date.now())
      console.log(`[${ts}] AGENT DONE ← ${event.agent} (${elapsed}ms)`)
      break
    }
    case 'task_start':
      console.log(`[${ts}] TASK START ↓ ${event.task}`)
      break
    case 'task_complete':
      console.log(`[${ts}] TASK DONE ↑ ${event.task}`)
      break
    case 'message':
      console.log(`[${ts}] MESSAGE • ${event.agent} → (team)`)
      break
    case 'error':
      console.error(`[${ts}] ERROR ✗ agent=${event.agent} task=${event.task}`)
      if (event.data instanceof Error) console.error(` ${event.data.message}`)
      break
  }
}

// ---------------------------------------------------------------------------
// Orchestrate
// ---------------------------------------------------------------------------
const orchestrator = new OpenMultiAgent({
  defaultModel: LITELLM_MODEL,
  defaultProvider: 'litellm',
  maxConcurrency: 1, // sequential for readable output
  onProgress: handleProgress,
})

const team = orchestrator.createTeam('api-team', {
  name: 'api-team',
  agents: [architect, developer, reviewer],
  sharedMemory: true,
  maxConcurrency: 1,
})

console.log(`LiteLLM proxy: ${process.env['LITELLM_BASE_URL'] ?? 'http://localhost:4000'}`)
console.log(`Model:         ${LITELLM_MODEL}`)
console.log(`Team "${team.name}" — agents: ${team.getAgents().map(a => a.name).join(', ')}`)
console.log('\nStarting team run...\n')
console.log('='.repeat(60))

const goal = `Create a minimal Express.js REST API in /tmp/litellm-api/ with:
- GET /health → { status: "ok" }
- GET /users → returns a hardcoded array of 2 user objects
- POST /users → accepts { name, email } body, logs it, returns 201
- Proper error handling middleware
- The server should listen on port 3002
- Include a package.json with the required dependencies`

const result = await orchestrator.runTeam(team, goal)

console.log('\n' + '='.repeat(60))

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('\nTeam run complete.')
console.log(`Success: ${result.success}`)
console.log(`Total tokens — input: ${result.totalTokenUsage.input_tokens}, output: ${result.totalTokenUsage.output_tokens}`)

console.log('\nPer-agent results:')
for (const [agentName, agentResult] of result.agentResults) {
  const status = agentResult.success ? 'OK' : 'FAILED'
  const tools = agentResult.toolCalls.length
  console.log(` ${agentName.padEnd(12)} [${status}] tool_calls=${tools}`)
  if (!agentResult.success) {
    console.log(` Error: ${agentResult.output.slice(0, 120)}`)
  }
}

const developerResult = result.agentResults.get('developer')
if (developerResult?.success) {
  console.log('\nDeveloper output (last 600 chars):')
  console.log('─'.repeat(60))
  const out = developerResult.output
  console.log(out.length > 600 ? '...' + out.slice(-600) : out)
  console.log('─'.repeat(60))
}

const reviewerResult = result.agentResults.get('reviewer')
if (reviewerResult?.success) {
  console.log('\nReviewer output:')
  console.log('─'.repeat(60))
  console.log(reviewerResult.output)
  console.log('─'.repeat(60))
}
