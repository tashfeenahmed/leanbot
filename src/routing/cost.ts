/**
 * Cost Tracker
 * Tracks LLM usage costs with budget limits and warnings
 */

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  sessionId: string;
  cost: number;
  timestamp: Date;
}

export interface BudgetStatus {
  dailySpend: number;
  monthlySpend: number;
  dailyBudget: number | undefined;
  monthlyBudget: number | undefined;
  dailyRemaining: number | undefined;
  monthlyRemaining: number | undefined;
  isDailyExceeded: boolean;
  isMonthlyExceeded: boolean;
  isDailyWarning: boolean;
  isMonthlyWarning: boolean;
}

export interface CostTrackerOptions {
  dailyBudget?: number;
  monthlyBudget?: number;
  warningThreshold?: number;
}

export interface UsageHistoryFilter {
  startDate?: Date;
  endDate?: Date;
  provider?: string;
  sessionId?: string;
}

export interface RequestCheck {
  allowed: boolean;
  reason?: string;
}

// Default pricing per million tokens (as of 2024)
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-20250514': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-3-opus-20240229': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-3-haiku-20240307': { inputPerMillion: 0.25, outputPerMillion: 1.25 },

  // OpenAI
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4-turbo': { inputPerMillion: 10, outputPerMillion: 30 },

  // Groq (Llama models)
  'llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  'llama-3.1-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  'mixtral-8x7b-32768': { inputPerMillion: 0.24, outputPerMillion: 0.24 },

  // Free/Local
  'llama3.2': { inputPerMillion: 0, outputPerMillion: 0 },
  'mistral': { inputPerMillion: 0, outputPerMillion: 0 },
};

export class CostTracker {
  private dailyBudget?: number;
  private monthlyBudget?: number;
  private warningThreshold: number;
  private customPricing: Map<string, ModelPricing> = new Map();
  private usageHistory: UsageRecord[] = [];

  constructor(options: CostTrackerOptions) {
    this.dailyBudget = options.dailyBudget;
    this.monthlyBudget = options.monthlyBudget;
    this.warningThreshold = options.warningThreshold ?? 0.75;
  }

  getDailyBudget(): number | undefined {
    return this.dailyBudget;
  }

  getMonthlyBudget(): number | undefined {
    return this.monthlyBudget;
  }

  getModelPricing(model: string): ModelPricing {
    // Check custom pricing first
    if (this.customPricing.has(model)) {
      return this.customPricing.get(model)!;
    }

    // Check default pricing
    if (model in DEFAULT_PRICING) {
      return DEFAULT_PRICING[model];
    }

    // Unknown model - return zero pricing
    return { inputPerMillion: 0, outputPerMillion: 0 };
  }

  setModelPricing(model: string, pricing: ModelPricing): void {
    this.customPricing.set(model, pricing);
  }

  calculateCost(
    model: string,
    usage: { inputTokens: number; outputTokens: number }
  ): number {
    const pricing = this.getModelPricing(model);
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
    return inputCost + outputCost;
  }

  recordUsage(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    provider: string;
    sessionId: string;
  }): void {
    const cost = this.calculateCost(params.model, {
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });

    this.usageHistory.push({
      ...params,
      cost,
      timestamp: new Date(),
    });
  }

  getDailySpend(): number {
    const today = this.getDateKey(new Date());
    return this.usageHistory
      .filter((r) => this.getDateKey(r.timestamp) === today)
      .reduce((sum, r) => sum + r.cost, 0);
  }

  getMonthlySpend(): number {
    const thisMonth = this.getMonthKey(new Date());
    return this.usageHistory
      .filter((r) => this.getMonthKey(r.timestamp) === thisMonth)
      .reduce((sum, r) => sum + r.cost, 0);
  }

  getSessionSpend(sessionId: string): number {
    return this.usageHistory
      .filter((r) => r.sessionId === sessionId)
      .reduce((sum, r) => sum + r.cost, 0);
  }

  isDailyBudgetExceeded(): boolean {
    if (this.dailyBudget === undefined) return false;
    return this.getDailySpend() >= this.dailyBudget;
  }

  isMonthlyBudgetExceeded(): boolean {
    if (this.monthlyBudget === undefined) return false;
    return this.getMonthlySpend() >= this.monthlyBudget;
  }

  isDailyWarningTriggered(): boolean {
    if (this.dailyBudget === undefined) return false;
    return this.getDailySpend() >= this.dailyBudget * this.warningThreshold;
  }

  isMonthlyWarningTriggered(): boolean {
    if (this.monthlyBudget === undefined) return false;
    return this.getMonthlySpend() >= this.monthlyBudget * this.warningThreshold;
  }

  getBudgetStatus(): BudgetStatus {
    const dailySpend = this.getDailySpend();
    const monthlySpend = this.getMonthlySpend();

    return {
      dailySpend,
      monthlySpend,
      dailyBudget: this.dailyBudget,
      monthlyBudget: this.monthlyBudget,
      dailyRemaining:
        this.dailyBudget !== undefined ? this.dailyBudget - dailySpend : undefined,
      monthlyRemaining:
        this.monthlyBudget !== undefined ? this.monthlyBudget - monthlySpend : undefined,
      isDailyExceeded: this.isDailyBudgetExceeded(),
      isMonthlyExceeded: this.isMonthlyBudgetExceeded(),
      isDailyWarning: this.isDailyWarningTriggered(),
      isMonthlyWarning: this.isMonthlyWarningTriggered(),
    };
  }

  getUsageHistory(filter?: UsageHistoryFilter): UsageRecord[] {
    let records = [...this.usageHistory];

    if (filter) {
      if (filter.startDate) {
        records = records.filter((r) => r.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        records = records.filter((r) => r.timestamp <= filter.endDate!);
      }
      if (filter.provider) {
        records = records.filter((r) => r.provider === filter.provider);
      }
      if (filter.sessionId) {
        records = records.filter((r) => r.sessionId === filter.sessionId);
      }
    }

    return records;
  }

  canMakeRequest(): RequestCheck {
    if (this.isDailyBudgetExceeded()) {
      return {
        allowed: false,
        reason: `Daily budget exceeded: $${this.getDailySpend().toFixed(4)} / $${this.dailyBudget}`,
      };
    }

    if (this.isMonthlyBudgetExceeded()) {
      return {
        allowed: false,
        reason: `Monthly budget exceeded: $${this.getMonthlySpend().toFixed(4)} / $${this.monthlyBudget}`,
      };
    }

    return { allowed: true };
  }

  private getDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7);
  }
}
