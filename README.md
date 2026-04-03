# Open Multi-Agent

Build AI agent teams that decompose goals into tasks automatically. Define agents with roles and tools, describe a goal — the framework plans the task graph, schedules dependencies, and runs everything in parallel.

3 runtime dependencies. 27 source files. One `runTeam()` call from goal to result.

[![GitHub stars](https://img.shields.io/github/stars/JackChen-me/open-multi-agent)](https://github.com/JackChen-me/open-multi-agent/stargazers)
[![license](https://img.shields.io/github/license/JackChen-me/open-multi-agent)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)

**English** | [中文](./README_zh.md)

## Why Open Multi-Agent?

- **Auto Task Decomposition** — Describe a goal in plain text. A built-in coordinator agent breaks it into a task DAG with dependencies and assignees — no manual orchestration needed.
- **Multi-Agent Teams** — Define agents with different roles, tools, and even different models. They collaborate through a message bus and shared memory.
- **Task DAG Scheduling** — Tasks have dependencies. The framework resolves them topologically — dependent tasks wait, independent tasks run in parallel.
- **Model Agnostic** — Claude, GPT, Gemma 4, and local models (Ollama, vLLM, LM Studio) in the same team. Swap models per agent via `baseURL`.
- **Structured Output** — Add `outputSchema` (Zod) to any agent. Output is parsed as JSON, validated, and auto-retried once on failure. Access typed results via `result.structured`.
- **Task Retry** — Set `maxRetries` on tasks for automatic retry with exponential backoff. Failed attempts accumulate token usage for accurate billing.
- **In-Process Execution** — No subprocess overhead. Everything runs in one Node.js process. Deploy to serverless, Docker, CI/CD.

## Quick Start

Requires Node.js >= 18.

```bash
npm install @jackchen_me/open-multi-agent
```

Set `ANTHROPIC_API_KEY` (and optionally `OPENAI_API_KEY` or `GITHUB_TOKEN` for Copilot) in your environment. Local models via Ollama require no API key — see [example 06](examples/06-local-model.ts).

Three agents, one goal — the framework handles the rest:

```typescript
import { OpenMultiAgent } from '@jackchen_me/open-multi-agent'
import type { AgentConfig } from '@jackchen_me/open-multi-agent'

const architect: AgentConfig = {
  name: 'architect',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You design clean API contracts and file structures.',
  tools: ['file_write'],
}

const developer: AgentConfig = {
  name: 'developer',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You implement what the architect designs.',
  tools: ['bash', 'file_read', 'file_write', 'file_edit'],
}

const reviewer: AgentConfig = {
  name: 'reviewer',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You review code for correctness and clarity.',
  tools: ['file_read', 'grep'],
}

const orchestrator = new OpenMultiAgent({
  defaultModel: 'claude-sonnet-4-6',
  onProgress: (event) => console.log(event.type, event.agent ?? event.task ?? ''),
})

const team = orchestrator.createTeam('api-team', {
  name: 'api-team',
  agents: [architect, developer, reviewer],
  sharedMemory: true,
})

// Describe a goal — the framework breaks it into tasks and orchestrates execution
const result = await orchestrator.runTeam(team, 'Create a REST API for a todo list in /tmp/todo-api/')

console.log(`Success: ${result.success}`)
console.log(`Tokens: ${result.totalTokenUsage.output_tokens} output tokens`)
```

What happens under the hood:

```
agent_start coordinator
task_start architect
task_complete architect
task_start developer
task_start developer              // independent tasks run in parallel
task_complete developer
task_start reviewer               // unblocked after implementation
task_complete developer
task_complete reviewer
agent_complete coordinator        // synthesizes final result
Success: true
Tokens: 12847 output tokens
```

## Three Ways to Run

| Mode | Method | When to use |
|------|--------|-------------|
| Single agent | `runAgent()` | One agent, one prompt — simplest entry point |
| Auto-orchestrated team | `runTeam()` | Give a goal, framework plans and executes |
| Explicit pipeline | `runTasks()` | You define the task graph and assignments |

## Contributors

<a href="https://github.com/JackChen-me/open-multi-agent/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=JackChen-me/open-multi-agent" />
</a>

## Examples

All examples are runnable scripts in [`examples/`](./examples/). Run any of them with `npx tsx`:

```bash
npx tsx examples/01-single-agent.ts
```

| Example | What it shows |
|---------|---------------|
| [01 — Single Agent](examples/01-single-agent.ts) | `runAgent()` one-shot, `stream()` streaming, `prompt()` multi-turn |
| [02 — Team Collaboration](examples/02-team-collaboration.ts) | `runTeam()` auto-orchestration with coordinator pattern |
| [03 — Task Pipeline](examples/03-task-pipeline.ts) | `runTasks()` explicit dependency graph (design → implement → test + review) |
| [04 — Multi-Model Team](examples/04-multi-model-team.ts) | `defineTool()` custom tools, mixed Anthropic + OpenAI providers, `AgentPool` |
| [05 — Copilot](examples/05-copilot-test.ts) | GitHub Copilot as an LLM provider |
| [06 — Local Model](examples/06-local-model.ts) | Ollama + Claude in one pipeline via `baseURL` (works with vLLM, LM Studio, etc.) |
| [07 — Fan-Out / Aggregate](examples/07-fan-out-aggregate.ts) | `runParallel()` MapReduce — 3 analysts in parallel, then synthesize |
| [08 — Gemma 4 Local](examples/08-gemma4-local.ts) | Pure-local Gemma 4 agent team with tool-calling — zero API cost |
| [09 — Gemma 4 Auto-Orchestration](examples/09-gemma4-auto-orchestration.ts) | `runTeam()` with Gemma 4 as coordinator — auto task decomposition, fully local |
| [10 — Structured Output](examples/10-structured-output.ts) | `outputSchema` (Zod) on AgentConfig — validated JSON via `result.structured` |
| [11 — Task Retry](examples/11-task-retry.ts) | `maxRetries` / `retryDelayMs` / `retryBackoff` with `task_retry` progress events |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenMultiAgent (Orchestrator)                                  │
│                                                                 │
│  createTeam()  runTeam()  runTasks()  runAgent()  getStatus()   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
            ┌──────────▼──────────┐
            │  Team               │
            │  - AgentConfig[]    │
            │  - MessageBus       │
            │  - TaskQueue        │
            │  - SharedMemory     │
            └──────────┬──────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
┌────────▼──────────┐    ┌───────────▼───────────┐
│  AgentPool        │    │  TaskQueue             │
│  - Semaphore      │    │  - dependency graph    │
│  - runParallel()  │    │  - auto unblock        │
└────────┬──────────┘    │  - cascade failure     │
         │               └───────────────────────┘
┌────────▼──────────┐
│  Agent            │
│  - run()          │    ┌──────────────────────┐
│  - prompt()       │───►│  LLMAdapter          │
│  - stream()       │    │  - AnthropicAdapter  │
└────────┬──────────┘    │  - OpenAIAdapter     │
         │               │  - CopilotAdapter    │
         │               └──────────────────────┘
┌────────▼──────────┐
│  AgentRunner      │    ┌──────────────────────┐
│  - conversation   │───►│  ToolRegistry        │
│    loop           │    │  - defineTool()      │
│  - tool dispatch  │    │  - 5 built-in tools  │
└───────────────────┘    └──────────────────────┘
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands. Returns stdout + stderr. Supports timeout and cwd. |
| `file_read` | Read file contents at an absolute path. Supports offset/limit for large files. |
| `file_write` | Write or create a file. Auto-creates parent directories. |
| `file_edit` | Edit a file by replacing an exact string match. |
| `grep` | Search file contents with regex. Uses ripgrep when available, falls back to Node.js. |

## Supported Providers

| Provider | Config | Env var | Status |
|----------|--------|---------|--------|
| Anthropic (Claude) | `provider: 'anthropic'` | `ANTHROPIC_API_KEY` | Verified |
| OpenAI (GPT) | `provider: 'openai'` | `OPENAI_API_KEY` | Verified |
| GitHub Copilot | `provider: 'copilot'` | `GITHUB_TOKEN` | Verified |
| Ollama / vLLM / LM Studio | `provider: 'openai'` + `baseURL` | — | Verified |

Verified local models with tool-calling: **Gemma 4** (see [example 08](examples/08-gemma4-local.ts)).

Any OpenAI-compatible API should work via `provider: 'openai'` + `baseURL` (DeepSeek, Groq, Mistral, Qwen, MiniMax, etc.). These providers have not been fully verified yet — contributions welcome via [#25](https://github.com/JackChen-me/open-multi-agent/issues/25).

## Contributing

Issues, feature requests, and PRs are welcome. Some areas where contributions would be especially valuable:

- **Provider integrations** — Verify and document OpenAI-compatible providers (DeepSeek, Groq, Qwen, MiniMax, etc.) via `baseURL`. See [#25](https://github.com/JackChen-me/open-multi-agent/issues/25). For providers that are NOT OpenAI-compatible (e.g. Gemini), a new `LLMAdapter` implementation is welcome — the interface requires just two methods: `chat()` and `stream()`.
- **Examples** — Real-world workflows and use cases.
- **Documentation** — Guides, tutorials, and API docs.

## Star History

<a href="https://star-history.com/#JackChen-me/open-multi-agent&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JackChen-me/open-multi-agent&type=Date&theme=dark&v=20260403" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JackChen-me/open-multi-agent&type=Date&v=20260403" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=JackChen-me/open-multi-agent&type=Date&v=20260403" />
 </picture>
</a>

## License

MIT
