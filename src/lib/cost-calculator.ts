// Cost Calculator for Claude Sonnet 4 API Usage
// Tracks tokens and calculates costs in USD

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  inputCost: number;  // USD
  outputCost: number; // USD
  totalCost: number;  // USD
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Claude Sonnet 4 Pricing (as of Jan 2025)
// Source: https://www.anthropic.com/pricing
// Dollars per 1M tokens. calculateCost divides token counts by 1_000_000, so
// these must be the per-million rate (previously 0.003/0.015, which undercounted
// cost by 1000x). Claude Sonnet 4.5: $3 / $15 per 1M in/out.
const CLAUDE_PRICING = {
  model: 'claude-sonnet-4-5-20250929',
  input: 3,    // $3 per 1M input tokens
  output: 15,  // $15 per 1M output tokens
} as const;

/**
 * Calculate cost for given token usage
 */
export function calculateCost(tokenUsage: TokenUsage): CostBreakdown {
  const inputCost = (tokenUsage.inputTokens / 1_000_000) * CLAUDE_PRICING.input;
  const outputCost = (tokenUsage.outputTokens / 1_000_000) * CLAUDE_PRICING.output;
  
  return {
    inputCost: Number(inputCost.toFixed(6)),
    outputCost: Number(outputCost.toFixed(6)),
    totalCost: Number((inputCost + outputCost).toFixed(6)),
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    totalTokens: tokenUsage.totalTokens
  };
}

/**
 * Estimate tokens for a message
 * Rough approximation: ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cumulative cost for multiple messages
 */
export function calculateConversationCost(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): CostBreakdown {
  let inputTokens = 0;
  let outputTokens = 0;
  
  messages.forEach(msg => {
    const tokens = estimateTokens(msg.content);
    if (msg.role === 'user') {
      inputTokens += tokens;
    } else {
      outputTokens += tokens;
    }
  });
  
  // Add system message overhead (~500 tokens)
  inputTokens += 500;
  
  return calculateCost({
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  });
}

/**
 * Project monthly costs based on usage
 */
export function projectMonthlyCost(
  avgLessonsPerUser: number,
  avgCostPerLesson: number,
  totalUsers: number
): {
  totalCost: number;
  perUserCost: number;
  breakdown: {
    apiCost: number;
    buffer: number; // 20% buffer for spikes
  };
} {
  const apiCost = avgLessonsPerUser * avgCostPerLesson * totalUsers;
  const buffer = apiCost * 0.2;
  const totalCost = apiCost + buffer;
  
  return {
    totalCost: Number(totalCost.toFixed(2)),
    perUserCost: totalUsers > 0 ? Number((totalCost / totalUsers).toFixed(2)) : 0,
    breakdown: {
      apiCost: Number(apiCost.toFixed(2)),
      buffer: Number(buffer.toFixed(2))
    }
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}‰`; // Per mille
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Get cost tier based on usage
 */
export function getCostTier(monthlyCost: number): {
  tier: 'Free' | 'Low' | 'Medium' | 'High' | 'Enterprise';
  color: string;
  description: string;
} {
  if (monthlyCost === 0) {
    return {
      tier: 'Free',
      color: 'text-gray-600',
      description: 'No API usage this month'
    };
  }
  if (monthlyCost < 10) {
    return {
      tier: 'Low',
      color: 'text-green-600',
      description: 'Minimal usage - hobby tier'
    };
  }
  if (monthlyCost < 50) {
    return {
      tier: 'Medium',
      color: 'text-blue-600',
      description: 'Regular usage - pro tier'
    };
  }
  if (monthlyCost < 200) {
    return {
      tier: 'High',
      color: 'text-orange-600',
      description: 'Heavy usage - team tier'
    };
  }
  return {
    tier: 'Enterprise',
    color: 'text-purple-600',
    description: 'Enterprise-level usage'
  };
}

/**
 * Calculate cost efficiency metrics
 */
export function calculateEfficiency(
  totalCost: number,
  totalLessons: number,
  totalUsers: number
): {
  costPerLesson: number;
  costPerUser: number;
  lessonsPerDollar: number;
} {
  return {
    costPerLesson: totalLessons > 0 ? Number((totalCost / totalLessons).toFixed(4)) : 0,
    costPerUser: totalUsers > 0 ? Number((totalCost / totalUsers).toFixed(2)) : 0,
    lessonsPerDollar: totalCost > 0 ? Number((totalLessons / totalCost).toFixed(1)) : 0
  };
}

// Example usage and benchmarks
export const BENCHMARKS = {
  avgLessonDuration: 5, // minutes
  avgMessagesPerLesson: 10,
  avgTokensPerMessage: 150,
  estimatedCostPerLesson: 0.06, // $0.06
  monthlyActiveUsers: 100,
  avgLessonsPerUserPerMonth: 8,
  estimatedMonthlyCost: 48 // $48 for 100 users
} as const;
