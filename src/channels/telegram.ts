import { Bot, Context } from 'grammy';
import type { Logger } from 'pino';
import type { Agent } from '../agent/agent.js';
import type { SessionManager } from '../agent/session.js';

const MAX_MESSAGE_LENGTH = 4096;
const TYPING_INTERVAL = 5000; // 5 seconds

export interface TelegramChannelOptions {
  botToken: string;
  agent: Agent;
  sessionManager: SessionManager;
  logger: Logger;
}

export function getStartMessage(): string {
  return `Welcome to LeanBot! 🤖

I'm your personal AI assistant. I can help you with:
• Reading and writing files
• Executing commands
• General questions and tasks

Just send me a message and I'll do my best to help!

Commands:
• /start - Show this message
• /reset - Clear conversation history`;
}

export function formatMarkdownToHtml(text: string): string {
  // First escape HTML entities
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert code blocks first (before other formatting)
  result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre>${code.trim()}</pre>`;
  });

  // Convert inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert bold (** or __)
  result = result.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  result = result.replace(/__(.+?)__/g, '<b>$1</b>');

  // Convert italic (* or _) - be careful not to match inside code blocks
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');

  return result;
}

export function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitIndex = remaining.lastIndexOf('\n\n', MAX_MESSAGE_LENGTH);

    // If no paragraph, try line boundary
    if (splitIndex === -1 || splitIndex < MAX_MESSAGE_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    }

    // If no line boundary, try space
    if (splitIndex === -1 || splitIndex < MAX_MESSAGE_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
    }

    // Force split if no good boundary found
    if (splitIndex === -1 || splitIndex < MAX_MESSAGE_LENGTH / 2) {
      splitIndex = MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

export class TelegramChannel {
  private bot: Bot;
  private agent: Agent;
  private sessionManager: SessionManager;
  private logger: Logger;
  public userSessions: Map<string, string> = new Map();
  private isRunning = false;

  constructor(options: TelegramChannelOptions) {
    this.bot = new Bot(options.botToken);
    this.agent = options.agent;
    this.sessionManager = options.sessionManager;
    this.logger = options.logger.child({ channel: 'telegram' });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(getStartMessage());
    });

    // /reset command
    this.bot.command('reset', async (ctx) => {
      const userId = ctx.from?.id.toString();
      if (!userId) return;

      await this.handleReset(userId);
      await ctx.reply('Conversation history cleared. Starting fresh!');
    });

    // Handle regular messages
    this.bot.on('message:text', async (ctx) => {
      await this.handleMessage(ctx);
    });

    // Error handler
    this.bot.catch((err) => {
      this.logger.error({ error: err.message }, 'Bot error');
    });
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const messageText = ctx.message?.text;

    if (!userId || !messageText) {
      return;
    }

    this.logger.info({ userId, message: messageText.substring(0, 100) }, 'Received message');

    // Start typing indicator
    const typingInterval = this.startTypingIndicator(ctx);

    try {
      // Get or create session
      const sessionId = await this.getOrCreateSession(userId);

      // Process message through agent
      const result = await this.agent.processMessage(sessionId, messageText);

      // Stop typing indicator
      clearInterval(typingInterval);

      // Format and send response
      const formattedResponse = formatMarkdownToHtml(result.response);
      const chunks = splitMessage(formattedResponse);

      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: 'HTML' });
        } catch (parseError) {
          // If HTML parsing fails, send as plain text
          this.logger.warn({ error: (parseError as Error).message }, 'HTML parse failed, sending plain text');
          await ctx.reply(chunk.replace(/<[^>]*>/g, ''));
        }
      }

      this.logger.info(
        { userId, responseLength: result.response.length, tokens: result.tokenUsage },
        'Sent response'
      );
    } catch (error) {
      clearInterval(typingInterval);
      const err = error as Error;
      this.logger.error({ userId, error: err.message }, 'Failed to process message');
      await ctx.reply('Sorry, I encountered an error processing your message. Please try again.');
    }
  }

  private startTypingIndicator(ctx: Context): NodeJS.Timeout {
    // Send typing action immediately
    ctx.replyWithChatAction('typing').catch(() => {});

    // Refresh every 5 seconds
    return setInterval(() => {
      ctx.replyWithChatAction('typing').catch(() => {});
    }, TYPING_INTERVAL);
  }

  async getOrCreateSession(userId: string): Promise<string> {
    // Check cache
    const cached = this.userSessions.get(userId);
    if (cached) {
      // Verify session still exists
      const session = await this.sessionManager.getSession(cached);
      if (session) {
        return cached;
      }
    }

    // Create new session
    const session = await this.sessionManager.createSession({
      userId,
      channelId: 'telegram',
    });

    this.userSessions.set(userId, session.id);
    return session.id;
  }

  async handleReset(userId: string): Promise<void> {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      await this.sessionManager.deleteSession(sessionId);
      this.userSessions.delete(userId);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.logger.info('Starting Telegram bot...');
    this.isRunning = true;

    // Use long polling
    await this.bot.start({
      onStart: (botInfo) => {
        this.logger.info({ username: botInfo.username }, 'Telegram bot started');
      },
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Telegram bot...');
    await this.bot.stop();
    this.isRunning = false;
    this.logger.info('Telegram bot stopped');
  }
}
