import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  estimateTokens,
  calculateConversationCost,
  projectMonthlyCost,
  formatCost,
  getCostTier,
  calculateEfficiency,
} from '../cost-calculator';

describe('calculateCost', () => {
  it('calculates cost for 1M input tokens correctly', () => {
    const result = calculateCost({
      inputTokens: 1_000_000,
      outputTokens: 0,
      totalTokens: 1_000_000,
    });

    expect(result.inputCost).toBe(3);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(3);
  });

  it('calculates cost for 1M output tokens correctly', () => {
    const result = calculateCost({
      inputTokens: 0,
      outputTokens: 1_000_000,
      totalTokens: 1_000_000,
    });

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(15);
    expect(result.totalCost).toBe(15);
  });

  it('calculates mixed input/output costs', () => {
    const result = calculateCost({
      inputTokens: 500_000,
      outputTokens: 300_000,
      totalTokens: 800_000,
    });

    expect(result.inputCost).toBe(1.5); // 500k * $3/M
    expect(result.outputCost).toBe(4.5); // 300k * $15/M
    expect(result.totalCost).toBe(6);
  });

  it('returns zero for zero tokens', () => {
    const result = calculateCost({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('preserves token counts in output', () => {
    const result = calculateCost({
      inputTokens: 1234,
      outputTokens: 5678,
      totalTokens: 6912,
    });

    expect(result.inputTokens).toBe(1234);
    expect(result.outputTokens).toBe(5678);
    expect(result.totalTokens).toBe(6912);
  });
});

describe('estimateTokens', () => {
  it('estimates tokens for empty string as 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcdefghi')).toBe(3);
  });
});

describe('calculateConversationCost', () => {
  it('calculates cost for a simple conversation', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello there' },
      { role: 'assistant' as const, content: 'Hi! How can I help?' },
    ];

    const result = calculateConversationCost(messages);

    expect(result.inputTokens).toBeGreaterThan(500); // 500 overhead + user msg
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens);
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it('handles empty conversation', () => {
    const result = calculateConversationCost([]);

    expect(result.inputTokens).toBe(500); // Just system overhead
    expect(result.outputTokens).toBe(0);
  });
});

describe('projectMonthlyCost', () => {
  it('projects costs for 100 users correctly', () => {
    const result = projectMonthlyCost(8, 0.06, 100);

    expect(result.breakdown.apiCost).toBe(48); // 8 * 0.06 * 100
    expect(result.breakdown.buffer).toBe(9.6); // 20%
    expect(result.totalCost).toBe(57.6);
    expect(result.perUserCost).toBe(0.58);
  });

  it('returns zero for zero users', () => {
    const result = projectMonthlyCost(10, 0.1, 0);

    expect(result.totalCost).toBe(0);
    expect(result.perUserCost).toBe(0);
  });
});

describe('formatCost', () => {
  it('formats regular costs with 4 decimals', () => {
    expect(formatCost(0.1234)).toBe('$0.1234');
    expect(formatCost(1.5)).toBe('$1.5000');
  });

  it('uses per-mille for very small costs', () => {
    expect(formatCost(0.005)).toBe('$5.00‰');
    expect(formatCost(0.001)).toBe('$1.00‰');
  });
});

describe('getCostTier', () => {
  it('returns Free for zero cost', () => {
    const result = getCostTier(0);
    expect(result.tier).toBe('Free');
  });

  it('returns Low for under $10', () => {
    expect(getCostTier(5).tier).toBe('Low');
  });

  it('returns Medium for $10-$50', () => {
    expect(getCostTier(25).tier).toBe('Medium');
  });

  it('returns High for $50-$200', () => {
    expect(getCostTier(100).tier).toBe('High');
  });

  it('returns Enterprise for $200+', () => {
    expect(getCostTier(500).tier).toBe('Enterprise');
  });
});

describe('calculateEfficiency', () => {
  it('calculates efficiency metrics correctly', () => {
    const result = calculateEfficiency(48, 800, 100);

    expect(result.costPerLesson).toBe(0.06);
    expect(result.costPerUser).toBe(0.48);
    expect(result.lessonsPerDollar).toBe(16.7);
  });

  it('handles zero totalCost gracefully', () => {
    const result = calculateEfficiency(0, 100, 50);

    expect(result.costPerLesson).toBe(0);
    expect(result.lessonsPerDollar).toBe(0);
  });

  it('handles zero users gracefully', () => {
    const result = calculateEfficiency(100, 100, 0);

    expect(result.costPerUser).toBe(0);
  });
});
