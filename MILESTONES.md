# LeanBot Development Milestones

> **Principle**: At the end of every milestone, everything works end-to-end. No half-built features.

## Overview

| Milestone | Name | Focus | Status |
|-----------|------|-------|--------|
| 1 | **MVP** | End-to-end working bot | ✅ Complete |
| 2 | **Smart Routing** | Cost efficiency | Pending |
| 3 | **Full Features** | Feature parity + extras | Pending |
| 4 | **Production Ready** | Polish & reliability | Pending |

---

## Milestone 1: MVP ✅

Working personal AI assistant via Telegram that executes tasks on VPS with session persistence.

- [x] **Project Setup**: TypeScript, pino logging, zod validation, Commander CLI, Vitest tests
- [x] **LLM Provider**: Anthropic with retry logic, token tracking, streaming support
- [x] **Core Tools**: Read, Write, Edit, Bash with full error handling
- [x] **Session Manager**: JSONL persistence, message history, token usage tracking
- [x] **Agent Runtime**: 20-iteration loop, tool execution, SOUL.md support
- [x] **Telegram Channel**: grammY bot, /start, /reset, markdown→HTML, message splitting
- [x] **Gateway Server**: Unified init, graceful shutdown (SIGTERM/SIGINT)

**Tests**: 101 passing | **Status**: Shipped

---

## Milestone 2: Smart Routing

Cost efficiency through intelligent model selection and context management.

### 2.1 Complexity Analyzer
- Tier detection: trivial, simple, moderate, complex
- Signals: token count, code presence, keywords, tool prediction

### 2.2 Multiple Providers
- OpenAI, Groq, Ollama (local), OpenRouter
- Provider health checking and fallback chain

### 2.3 Cost Tracking
- Per-request tracking with model pricing
- Daily/monthly budget limits with hard stops
- 75% warning threshold

### 2.4 Sliding Window Context
- Hot window (last 5 messages) + warm summary (compressed older context)
- Tool output truncation (30KB max) with hash retrieval
- Auto-compress at 70% capacity

---

## Milestone 3: Full Features

Feature parity with alternatives plus LeanBot-specific enhancements.

### 3.1 Additional Channels
- Discord with slash commands and mentions
- CLI REPL with syntax highlighting

### 3.2 Skill System
- SKILL.md parser with OpenClaw compatibility
- ClawHub integration for skill search/install
- Lazy loading (load on-demand, not startup)

### 3.3 Cron Scheduler
- Unified system (replaces separate heartbeats)
- Built-in actions: ping, status, backup
- Channel-specific notifications

### 3.4 Gardener Memory
- Hot collector (append during conversation)
- Background gardener (fact extraction, summarization)
- Hybrid search (vector + BM25)

---

## Milestone 4: Production Ready

Polish, reliability, and deployment features.

### 4.1 Caching
- Semantic response cache with TTL
- Tool output deduplication

### 4.2 Session Branching
- Sub-conversations for investigation
- Summarize & merge or discard

### 4.3 Dashboard & Deployment
- Cost dashboard CLI
- Systemd integration with `leanbot daemon install`
- Crash recovery with resume/restart/abort options

### 4.4 Reliability
- Provider fallback chain
- Budget exhaustion handling with task queuing
- Proactive notifications (errors, budget, completions)
