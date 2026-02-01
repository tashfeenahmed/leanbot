/**
 * Complexity Analyzer
 * Analyzes message complexity to determine appropriate model tier
 */

export enum ComplexityTier {
  Trivial = 'trivial',
  Simple = 'simple',
  Moderate = 'moderate',
  Complex = 'complex',
}

export interface ComplexitySignals {
  estimatedTokens: number;
  hasCode: boolean;
  complexityKeywords: string[];
  predictedTools: string[];
  isMultiStep: boolean;
}

export type ModelTier = 'fast' | 'standard' | 'capable';

export interface ComplexityResult {
  tier: ComplexityTier;
  signals: ComplexitySignals;
  confidence: number;
  suggestedModelTier: ModelTier;
}

// Patterns for complexity detection
const TRIVIAL_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|bye|goodbye)[\s!?.]*$/i,
  /^what (time|day) is it\??$/i,
  /^(good |how are |how's )?(morning|afternoon|evening|night|you)\??$/i,
];

const COMPLEXITY_KEYWORDS = [
  'refactor',
  'optimize',
  'debug',
  'investigate',
  'architecture',
  'design',
  'implement',
  'migrate',
  'restructure',
  'rewrite',
  'analyze',
  'comprehensive',
  'entire',
  'full',
  'complete',
  'system',
  'performance',
  'security',
  'scalability',
  'caching',
  'layer',
  'strategies',
  'monitoring',
  'integration',
  'infrastructure',
];

const MULTI_STEP_INDICATORS = [
  /first[\s,].*then/i,
  /step\s*\d/i,
  /,\s*then\s/i,
  /,\s*and\s*then\s/i,
  /,\s*and\s*finally\s/i,
  /after\s+that/i,
  /\band\s+then\b/i,
  /\band\s+(explain|count|summarize|analyze|describe)\b/i, // read and explain, find and count, etc.
  /\b(read|find|get|fetch)\b.*\band\b/i, // read X and Y
];

const TOOL_PATTERNS = {
  read: [
    /\b(read|show|display|view|contents? of|what's in|open)\b.*\b(file|\.md|\.ts|\.js|\.json|\.txt|\.yaml|\.yml)\b/i,
    /\bcat\b/i,
    /\bexplain\b.*\b(file|code|what)\b/i,
  ],
  write: [
    /\b(create|write|make|generate|add)\b.*\b(file|function|class|module)\b/i,
    /\b(save|store)\s+(to|in)\s+/i,
  ],
  edit: [
    /\b(edit|modify|change|update|replace|fix)\b.*\b(file|function|class|code|line)\b/i,
    /\badd\b.*\bto\b.*\b(file)\b/i,
  ],
  bash: [
    /\b(run|execute|install|npm|yarn|pnpm|git|docker|curl|wget|ls|cd|mkdir)\b/i,
    /\bcommand\b/i,
    /\b(list|find|count|search)\b.*\b(files?|director)/i,
    /\ball\b.*\bfiles\b/i,
  ],
};

const CODE_PATTERNS = [
  /`[^`]+`/, // Inline code
  /```[\s\S]*?```/, // Code blocks
  /\b(const|let|var|function|class|import|export|return|if|for|while)\s/,
  /[{}\[\]();].*[{}\[\]();]/, // Multiple brackets suggesting code
];

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if message contains code
 */
function detectCode(text: string): boolean {
  return CODE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Extract complexity keywords from message
 */
function extractComplexityKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  return COMPLEXITY_KEYWORDS.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Predict which tools will be needed
 */
function predictTools(text: string): string[] {
  const tools: string[] = [];

  for (const [tool, patterns] of Object.entries(TOOL_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      tools.push(tool);
    }
  }

  return tools;
}

/**
 * Check if message indicates multi-step task
 */
function isMultiStep(text: string): boolean {
  return MULTI_STEP_INDICATORS.some((pattern) => pattern.test(text));
}

/**
 * Check if message is trivial
 */
function isTrivialMessage(text: string): boolean {
  const trimmed = text.trim();
  return TRIVIAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Calculate complexity score from signals (0-100)
 */
function calculateComplexityScore(signals: ComplexitySignals, text: string): number {
  let score = 0;

  // Token count contribution (0-30)
  if (signals.estimatedTokens > 100) score += 30;
  else if (signals.estimatedTokens > 50) score += 20;
  else if (signals.estimatedTokens > 20) score += 12;
  else if (signals.estimatedTokens > 10) score += 8;
  else if (signals.estimatedTokens > 5) score += 4;

  // Code presence (0-15)
  if (signals.hasCode) score += 15;

  // Complexity keywords (0-40) - higher weight per keyword
  score += Math.min(signals.complexityKeywords.length * 15, 40);

  // Predicted tools (0-25)
  score += Math.min(signals.predictedTools.length * 12, 25);

  // Multi-step (0-15)
  if (signals.isMultiStep) score += 15;

  // Question that's not trivial gets a small boost
  if (text.includes('?') && signals.estimatedTokens > 5) {
    score += 4;
  }

  return score;
}

/**
 * Determine tier from complexity score
 */
function tierFromScore(score: number, isTrivial: boolean): ComplexityTier {
  if (isTrivial) return ComplexityTier.Trivial;
  if (score >= 45) return ComplexityTier.Complex;
  if (score >= 22) return ComplexityTier.Moderate;
  if (score >= 8) return ComplexityTier.Simple;
  return ComplexityTier.Trivial;
}

/**
 * Calculate confidence based on signal clarity
 */
function calculateConfidence(
  tier: ComplexityTier,
  score: number,
  signals: ComplexitySignals,
  isTrivial: boolean
): number {
  // Base confidence
  let confidence = 0.5;

  // Clear trivial case
  if (isTrivial && signals.estimatedTokens < 10) {
    confidence = 0.95;
  }
  // Clear complex case - multiple strong signals
  else if (tier === ComplexityTier.Complex) {
    if (signals.complexityKeywords.length >= 2 || score >= 60) {
      confidence = 0.85;
    } else {
      confidence = 0.75;
    }
  }
  // Multiple strong signals for moderate/simple
  else if (signals.predictedTools.length >= 2 || signals.isMultiStep) {
    confidence = 0.75;
  }
  // Score is clearly in a tier range
  else if (score > 60 || score < 5) {
    confidence = 0.8;
  } else {
    // Uncertain case - score is near tier boundary
    confidence = 0.6;
  }

  return Math.min(confidence, 1);
}

/**
 * Suggest model tier based on complexity
 */
function suggestModelTier(tier: ComplexityTier): ModelTier {
  switch (tier) {
    case ComplexityTier.Trivial:
      return 'fast';
    case ComplexityTier.Simple:
      return 'fast';
    case ComplexityTier.Moderate:
      return 'standard';
    case ComplexityTier.Complex:
      return 'capable';
  }
}

/**
 * Analyze message complexity
 */
export function analyzeComplexity(message: string): ComplexityResult {
  const isTrivial = isTrivialMessage(message);

  const signals: ComplexitySignals = {
    estimatedTokens: estimateTokens(message),
    hasCode: detectCode(message),
    complexityKeywords: extractComplexityKeywords(message),
    predictedTools: predictTools(message),
    isMultiStep: isMultiStep(message),
  };

  const score = calculateComplexityScore(signals, message);
  const tier = tierFromScore(score, isTrivial);
  const confidence = calculateConfidence(tier, score, signals, isTrivial);
  const suggestedModelTier = suggestModelTier(tier);

  return {
    tier,
    signals,
    confidence,
    suggestedModelTier,
  };
}
