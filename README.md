# LeanBot

**The token-efficient AI agent that doesn't burn your wallet.**

LeanBot is a next-generation personal AI assistant architecture designed from the ground up for **minimal token consumption**, **intelligent cost management**, and **superior context handling**. Built as a response to the token-burning inefficiencies of existing solutions.

---

## Why LeanBot?

| Problem with Current Solutions | LeanBot's Answer |
|-------------------------------|------------------|
| $30-200/day token costs | Smart routing cuts costs 70-85% |
| Full history sent every request | Sliding window + semantic compression |
| No cost visibility until bill arrives | Real-time token/cost dashboard |
| Same expensive model for all tasks | Tiered model routing by complexity |
| Bloated session transcripts | Structured atomic memory |
| Complex Docker/VPS setup required | Single binary, runs anywhere |
| Tool outputs accumulate forever | Aggressive output truncation + caching |

---

## Core Philosophy

```
         LEAN                    ECONOMICAL                 SMART
    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
    │ 4 Core Tools│          │ Cost-First  │          │ Context-    │
    │ Minimal Deps│          │ Architecture│          │ Aware       │
    │ Small Binary│          │ Token Budget│          │ Decisions   │
    └─────────────┘          └─────────────┘          └─────────────┘
```

1. **Lean**: Minimal core (Read, Write, Edit, Bash). Everything else is a skill.
2. **Economical**: Every architectural decision optimizes for token efficiency.
3. **Smart**: The system makes intelligent decisions about what context to keep, what model to use, and when to cache.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              LEANBOT CORE                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        SMART ROUTER                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ Complexity  │  │   Model     │  │   Cost      │  │  Fallback   │  │  │
│  │  │  Analyzer   │→ │  Selector   │→ │  Guardian   │→ │   Chain     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      CONTEXT ENGINE                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Sliding    │  │  Semantic   │  │   Tool      │  │  Response   │  │  │
│  │  │  Window     │  │ Compressor  │  │  Truncator  │  │   Cache     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       MEMORY SYSTEM                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Hot       │  │  Gardener   │  │  Structured │  │   Hybrid    │  │  │
│  │  │  Collector  │→ │  (Async)    │→ │   Facts     │  │   Search    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                        │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│     │  Channels   │  │   Skills    │  │  Providers  │  │   Budget    │     │
│     │  (I/O)      │  │  (Actions)  │  │  (LLMs)     │  │  (Tracker)  │     │
│     └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Innovations

### 1. Tiered Model Routing (70-85% Cost Reduction)

LeanBot analyzes every request and routes to the cheapest capable model:

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLEXITY ANALYZER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input: "What time is it?"                                      │
│  Complexity: TRIVIAL → Route to: Local/Free Model               │
│                                                                 │
│  Input: "Summarize this email"                                  │
│  Complexity: SIMPLE → Route to: Haiku/GPT-4o-mini ($0.25/1M)   │
│                                                                 │
│  Input: "Review this code for bugs"                             │
│  Complexity: MODERATE → Route to: Sonnet/GPT-4o ($3/1M)        │
│                                                                 │
│  Input: "Architect a distributed system for..."                 │
│  Complexity: COMPLEX → Route to: Opus/GPT-4 ($15/1M)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Complexity Signals:**
- Token count of input
- Presence of code blocks
- Keywords: "analyze", "architect", "design", "compare", "debug"
- Required tools (browser = higher, file read = lower)
- Historical accuracy for similar queries

### 2. Sliding Window Context (Not Full History)

Unlike OpenClaw which sends **entire conversation history** with every request:

```
OpenClaw Approach (Expensive):
├── Message 1 (500 tokens)
├── Message 2 (800 tokens)
├── Message 3 (1200 tokens)
├── ... (accumulates forever)
├── Message 50 (600 tokens)
└── Total: 45,000 tokens PER REQUEST ❌

LeanBot Approach (Efficient):
├── System prompt (500 tokens)
├── Compressed summary of old context (200 tokens)
├── Last 5 relevant messages (2000 tokens)
├── Current message (600 tokens)
└── Total: 3,300 tokens PER REQUEST ✓
```

**Context Strategy:**
- **Hot window**: Last N messages (configurable, default 5)
- **Warm summary**: Semantic compression of older context
- **Cold storage**: Full history on disk, retrieved on-demand via search
- **Tool outputs**: Truncated aggressively, cached for re-retrieval

### 3. Gardener Memory Architecture

Two-phase memory processing inspired by how humans consolidate memories:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: COLLECTOR (Hot Path - During Conversation)            │
├─────────────────────────────────────────────────────────────────┤
│  • Append raw interactions to daily log                         │
│  • Minimal processing overhead                                  │
│  • Format: memory/YYYY-MM-DD.jsonl                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (Async, background)
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: GARDENER (Cold Path - Background Process)             │
├─────────────────────────────────────────────────────────────────┤
│  • Decompose logs into atomic facts                             │
│  • Build bidirectional links between facts                      │
│  • Generate summaries at multiple granularities                 │
│  • Prune redundant/outdated information                         │
│  • Update structured knowledge files                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STRUCTURED KNOWLEDGE (Queryable)                               │
├─────────────────────────────────────────────────────────────────┤
│  facts/                                                         │
│  ├── entities.json      # People, projects, tools mentioned     │
│  ├── preferences.json   # User preferences & settings           │
│  ├── decisions.json     # Decisions made with rationale         │
│  └── learnings.json     # What worked, what didn't              │
│                                                                 │
│  summaries/                                                     │
│  ├── daily/            # Daily interaction summaries            │
│  ├── weekly/           # Weekly rollups                         │
│  └── topics/           # Topic-based summaries                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Aggressive Tool Output Management

Tool outputs are the #1 cause of token bloat. LeanBot handles this:

```yaml
tool_output_policy:
  # Truncation
  max_output_tokens: 2000        # Hard cap per tool output
  truncation_strategy: "smart"   # Keep head + tail + summary

  # Caching
  cache_outputs: true
  cache_ttl: 3600                # 1 hour
  dedupe_identical: true         # Don't re-run same command

  # Replacement
  replace_old_outputs: true      # Old outputs become "[cached: hash]"
  on_demand_retrieval: true      # LLM can request full output if needed
```

**Before (OpenClaw):**
```
Tool: bash("cat package.json")
Output: [8,500 tokens of JSON, stays in context forever]
```

**After (LeanBot):**
```
Tool: bash("cat package.json")
Output: [500 token summary + hash reference]
Full output: [retrievable via `recall(hash)` if needed]
```

### 5. Real-Time Cost Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  LEANBOT COST DASHBOARD                          Session #47    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Current Session:                                               │
│  ├── Tokens used: 12,450 (input: 10,200 | output: 2,250)       │
│  ├── Cost: $0.08                                                │
│  ├── Models used: haiku (85%), sonnet (15%)                    │
│  └── Cache hits: 23 (saved ~8,000 tokens)                      │
│                                                                 │
│  Today:                                                         │
│  ├── Total cost: $1.24                                          │
│  ├── Budget remaining: $3.76 / $5.00                           │
│  └── Projected monthly: $37.20                                  │
│                                                                 │
│  Savings vs naive approach: 78% ($4.40 saved today)            │
│                                                                 │
│  [!] Alert: Approaching daily budget (75%)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Session Branching (Not Linear)

Inspired by Pi's tree-structured sessions:

```
Main conversation
│
├── User: "Help me debug this auth issue"
│   │
│   ├── [Branch A: Investigation]
│   │   ├── Read auth.ts
│   │   ├── Read middleware.ts
│   │   ├── Found: token expiry bug
│   │   └── [Summarize & merge back: "Found bug in auth.ts:45"]
│   │
│   └── Continue main with summary (not full branch context)
│
└── User: "Great, now fix it"
    └── [Has summary, not 5000 tokens of investigation]
```

**Benefits:**
- Debug/investigation branches don't pollute main context
- Failed attempts can be discarded entirely
- Summaries preserve knowledge without token cost

### 7. Skill Lazy-Loading

Skills are NOT loaded into context until needed:

```
OpenClaw: Load all 50 skill schemas at startup → 15,000 tokens wasted

LeanBot:
├── Core tools always loaded (Read, Write, Edit, Bash) → 400 tokens
├── Skill index loaded (name + 1-line description) → 200 tokens
├── Full skill loaded ON DEMAND when referenced → variable
└── Skill unloaded after use if context pressure high
```

---

## Configuration

### SOUL.md (Identity)

```markdown
# soul.md - LeanBot Identity

## Core Values
- Efficiency over verbosity
- Actions over explanations
- Results over process narration

## Behavioral Rules
- Never say "I'd be happy to help" - just help
- Never explain what you're about to do - just do it
- If a task takes 1 tool call, don't use 5
- Prefer local/cached data over re-fetching
- Ask once, remember forever

## Token Discipline
- Responses under 200 tokens unless complexity demands more
- No filler phrases, no excessive politeness
- Code blocks over prose explanations
- Bullet points over paragraphs
```

### config.yaml

```yaml
leanbot:
  # Model Routing
  routing:
    strategy: "complexity-based"
    tiers:
      trivial:
        models: ["ollama/llama3", "groq/llama3"]
        max_tokens: 500
      simple:
        models: ["anthropic/haiku", "openai/gpt-4o-mini"]
        max_tokens: 2000
      moderate:
        models: ["anthropic/sonnet", "openai/gpt-4o"]
        max_tokens: 4000
      complex:
        models: ["anthropic/opus", "openai/gpt-4"]
        max_tokens: 8000

    # Fallback chain if primary fails
    fallback_order: ["anthropic", "openai", "groq", "ollama"]

  # Context Management
  context:
    max_tokens: 32000              # Hard limit
    hot_window_messages: 5         # Recent messages kept verbatim
    warm_summary_tokens: 500       # Compressed older context
    tool_output_max: 2000          # Per-output limit
    auto_compress_threshold: 0.7   # Compress at 70% capacity

  # Budget Controls
  budget:
    daily_limit: 5.00              # USD
    monthly_limit: 100.00
    warning_threshold: 0.75        # Alert at 75%
    hard_stop: true                # Stop at limit vs degrade

  # Memory
  memory:
    gardener_enabled: true
    gardener_interval: "5m"        # Process logs every 5 min
    fact_extraction: true
    summary_granularity: ["daily", "weekly", "topic"]

  # Caching
  cache:
    enabled: true
    response_ttl: 3600
    tool_output_ttl: 1800
    semantic_similarity_threshold: 0.92  # Cache hit threshold
```

---

## Project Structure

```
leanbot/
├── src/
│   ├── core/
│   │   ├── agent.ts              # Main agent loop
│   │   ├── tools.ts              # Core 4 tools (Read, Write, Edit, Bash)
│   │   └── session.ts            # Session & branching management
│   │
│   ├── router/
│   │   ├── complexity.ts         # Complexity analyzer
│   │   ├── selector.ts           # Model selector
│   │   ├── fallback.ts           # Fallback chain handler
│   │   └── cost-guardian.ts      # Budget enforcement
│   │
│   ├── context/
│   │   ├── window.ts             # Sliding window manager
│   │   ├── compressor.ts         # Semantic compression
│   │   ├── truncator.ts          # Tool output truncation
│   │   └── cache.ts              # Response & output cache
│   │
│   ├── memory/
│   │   ├── collector.ts          # Hot path logging
│   │   ├── gardener.ts           # Async fact extraction
│   │   ├── facts.ts              # Structured fact storage
│   │   ├── search.ts             # Hybrid vector + BM25 search
│   │   └── summaries.ts          # Multi-granularity summaries
│   │
│   ├── channels/
│   │   ├── cli.ts                # Terminal interface
│   │   ├── api.ts                # REST/WebSocket API
│   │   ├── telegram.ts           # Telegram adapter
│   │   ├── discord.ts            # Discord adapter
│   │   └── whatsapp.ts           # WhatsApp adapter
│   │
│   ├── skills/
│   │   ├── loader.ts             # Lazy skill loader
│   │   ├── registry.ts           # Skill index
│   │   └── builtin/              # Built-in skills
│   │       ├── browser.ts
│   │       ├── calendar.ts
│   │       └── email.ts
│   │
│   ├── providers/
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── groq.ts
│   │   ├── ollama.ts
│   │   └── openrouter.ts
│   │
│   ├── budget/
│   │   ├── tracker.ts            # Real-time cost tracking
│   │   ├── dashboard.ts          # Cost visualization
│   │   └── alerts.ts             # Budget alerts
│   │
│   └── index.ts                  # Entry point
│
├── config/
│   ├── default.yaml              # Default configuration
│   └── soul.md                   # Default identity
│
├── skills/                       # User-installed skills
├── memory/                       # Memory storage
├── tests/
└── docs/
```

---

## LeanBot vs OpenClaw Comparison

| Feature | OpenClaw | LeanBot |
|---------|----------|---------|
| **Token Efficiency** | Poor (full history every request) | Excellent (sliding window + compression) |
| **Cost Visibility** | After the fact | Real-time dashboard |
| **Model Routing** | Manual config | Automatic by complexity |
| **Setup Complexity** | Docker + VPS recommended | Single binary |
| **Tool Output Handling** | Accumulates forever | Truncate + cache + retrieve |
| **Memory Architecture** | Append-only JSONL | Gardener (async fact extraction) |
| **Session Model** | Linear | Tree (branching) |
| **Skill Loading** | All at startup | Lazy on-demand |
| **Budget Controls** | External (API dashboard) | Built-in with hard stops |
| **Estimated Daily Cost** | $30-200 | $3-15 (same usage) |

---

## Roadmap

### Phase 1: Core Engine
- [ ] Sliding window context manager
- [ ] Complexity analyzer
- [ ] Tiered model routing
- [ ] Basic cost tracking
- [ ] Core 4 tools

### Phase 2: Memory & Efficiency
- [ ] Gardener background process
- [ ] Structured fact extraction
- [ ] Hybrid search (vector + BM25)
- [ ] Response caching
- [ ] Tool output truncation & caching

### Phase 3: Channels & Skills
- [ ] CLI interface
- [ ] REST/WebSocket API
- [ ] Telegram adapter
- [ ] Skill lazy-loader
- [ ] Skill marketplace integration

### Phase 4: Advanced Features
- [ ] Session branching
- [ ] Multi-agent orchestration
- [ ] Proactive automation (cron)
- [ ] Cost prediction & optimization suggestions

---

## Quick Start

```bash
# Install (single binary, no Docker required)
curl -fsSL https://leanbot.dev/install.sh | sh

# Initialize
leanbot init

# Configure your API keys
leanbot config set anthropic.key sk-ant-xxx
leanbot config set openai.key sk-xxx

# Set your daily budget
leanbot config set budget.daily 5.00

# Run
leanbot start

# Or run in CLI mode
leanbot chat
```

---

## Why "Lean"?

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away." - Antoine de Saint-Exupery

LeanBot applies lean principles to AI agents:
- **Eliminate waste**: Don't send tokens you don't need
- **Just-in-time**: Load skills and context only when needed
- **Continuous improvement**: Gardener constantly optimizes memory
- **Respect for resources**: Your money, your tokens, your control

---

## License

MIT

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Core principle**: Every PR should reduce token usage or maintain it while adding features. PRs that increase baseline token consumption require strong justification.
