# LeanBot

A personal AI assistant that runs on your VPS, accessible via Telegram, with full system access and persistent sessions.

## Features

- **Telegram Integration**: Chat with your bot from anywhere
- **Full VPS Access**: Read/write files, execute commands, no sandbox restrictions
- **Session Persistence**: Conversations survive restarts (JSONL storage)
- **Core Tools**: Read, Write, Edit, Bash - everything you need
- **Token Tracking**: Monitor usage per session
- **Graceful Shutdown**: Proper SIGTERM/SIGINT handling

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/tashfeenahmed/leanbot.git
cd leanbot
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional - enables Telegram bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Optional - defaults to current directory
AGENT_WORKSPACE=/path/to/workspace
```

### 3. Build and Run

```bash
# Build
npm run build

# Start the gateway (with Telegram)
node dist/cli.js start

# Or interactive CLI chat (no Telegram needed)
node dist/cli.js chat
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `leanbot start` | Start gateway server with Telegram |
| `leanbot chat` | Interactive CLI chat session |
| `leanbot config` | Show current configuration |
| `leanbot version` | Show version |

### Start Options

```bash
# Verbose logging
leanbot start --verbose

# Resume existing chat session
leanbot chat --session <session-id>
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/reset` | Clear conversation history |

## Project Structure

```
src/
├── config/      # Zod schema, env loading
├── providers/   # Anthropic LLM integration
├── tools/       # Read, Write, Edit, Bash
├── agent/       # Runtime loop, session management
├── channels/    # Telegram bot
├── gateway/     # Server orchestration
└── cli.ts       # CLI entry point
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Type check
npm run typecheck

# Development with hot reload
npm run dev start
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token |
| `AGENT_WORKSPACE` | No | `cwd()` | Working directory for agent |
| `AGENT_MAX_ITERATIONS` | No | `20` | Max tool calls per message |
| `LOG_LEVEL` | No | `info` | Logging level |

### SOUL.md (Optional)

Create a `SOUL.md` in your workspace to customize agent behavior:

```markdown
# Agent Behavior

- Be concise
- Prefer code over explanations
- Always confirm destructive operations
```

## How It Works

1. **Message received** (Telegram or CLI)
2. **Session loaded** from JSONL file
3. **Agent loop**: LLM → Tool execution → Response
4. **Session saved** with new messages
5. **Response sent** back to user

The agent can chain up to 20 tool calls per message before responding.

## License

MIT

## Links

- [Milestones](./MILESTONES.md) - Development roadmap
- [Specification](./SPEC.md) - Full architecture details
