import { describe, it, expect } from 'vitest';
import {
  evaluateCEFR,
  evaluateTechnicalJargon,
  generateQuickFeedback,
  type CEFRAssessment,
} from '../cefr-evaluator';

describe('evaluateTechnicalJargon', () => {
  it('detects database terms correctly', () => {
    const messages = [
      'The replication lag is at 7200 seconds and there is a blocking query on the primary key index.',
    ];

    const result = evaluateTechnicalJargon(messages, 'database');

    expect(result.termsUsed).toContain('replication');
    expect(result.termsUsed).toContain('lag');
    expect(result.termsUsed).toContain('blocking');
    expect(result.termsUsed).toContain('query');
    expect(result.termsUsed).toContain('index');
    expect(result.termsUsed).toContain('primary key');
    expect(result.accuracy).toBeGreaterThan(50);
  });

  it('returns Basic for no technical terms', () => {
    const messages = ['Hello, how are you doing today?'];

    const result = evaluateTechnicalJargon(messages, 'database');

    expect(result.level).toBe('Basic');
    expect(result.termsUsed).toHaveLength(0);
  });

  it('returns Expert for extensive terminology usage', () => {
    const messages = [
      'The replication lag on the read replica is causing blocking queries. ' +
      'I need to check the transaction logs, commit the changes, and rollback if needed. ' +
      'Should we create an index on the foreign key and normalize the table? ' +
      'Maybe we should use sharding and partitioning for the stored procedure.',
    ];

    const result = evaluateTechnicalJargon(messages, 'database');

    expect(result.level).toBe('Expert');
    expect(result.termsUsed.length).toBeGreaterThan(8);
  });

  it('defaults to database terms when scenario is unknown', () => {
    const messages = ['There is a replication issue with the database.'];

    const result = evaluateTechnicalJargon(messages, 'unknown' as any);

    expect(result.termsUsed).toContain('replication');
  });
});

describe('evaluateCEFR', () => {
  it('returns default assessment for empty messages', () => {
    const result = evaluateCEFR([], 60, 'database', 0);

    expect(result.overall.level).toBe('B1');
    expect(result.overall.score).toBe(60);
  });

  it('returns default assessment for null/undefined messages', () => {
    const result = evaluateCEFR(undefined as any, 60, 'database', 0);

    expect(result.overall.level).toBe('B1');
  });

  it('calculates scores for a realistic conversation', () => {
    const messages = [
      'I checked the database replication and the lag is about 7200 seconds.',
      'There seems to be a blocking query that is preventing the replication from catching up.',
      'I will terminate the long-running query and monitor the replication status.',
      'The customers should be able to see their recent orders once the lag decreases.',
    ];

    const result = evaluateCEFR(messages, 300, 'database', 2);

    expect(result.overall.score).toBeGreaterThan(0);
    expect(result.overall.score).toBeLessThanOrEqual(100);
    expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(result.overall.level);

    expect(result.fluency.score).toBeGreaterThan(0);
    expect(result.vocabulary.score).toBeGreaterThan(0);
    expect(result.grammar.score).toBeGreaterThan(0);
    expect(result.interaction.score).toBeGreaterThan(0);
    expect(result.comprehension.score).toBeGreaterThan(0);
  });

  it('penalizes scores with many clarifications', () => {
    const messages = ['I see the issue', 'It is fixed now'];

    const resultWithManyClarifications = evaluateCEFR(messages, 120, 'database', 10);
    const resultWithFewClarifications = evaluateCEFR(messages, 120, 'database', 1);

    expect(resultWithManyClarifications.overall.score)
      .toBeLessThan(resultWithFewClarifications.overall.score);
  });

  it('rewards longer, more detailed messages', () => {
    const shortMessages = ['Hi', 'Ok', 'Done'];
    const longMessages = [
      'I checked the database replication and the lag is about 7200 seconds. ' +
      'There seems to be a blocking query that is preventing the replication from catching up.',
      'I will terminate the long-running query and monitor the replication status carefully. ' +
      'The customers should be able to see their recent orders once the lag decreases.',
    ];

    const shortResult = evaluateCEFR(shortMessages, 60, 'database', 0);
    const longResult = evaluateCEFR(longMessages, 60, 'database', 0);

    expect(longResult.overall.score).toBeGreaterThan(shortResult.overall.score);
  });

  it('includes technical jargon assessment', () => {
    const messages = [
      'The replication lag is high due to a blocking query on the index.',
    ];

    const result = evaluateCEFR(messages, 60, 'database', 0);

    expect(result.technicalJargon).toBeDefined();
    expect(result.technicalJargon.level).toBeDefined();
    expect(result.technicalJargon.termsUsed.length).toBeGreaterThan(0);
  });

  it('generates strengths and improvements feedback', () => {
    const messages = [
      'I checked the database replication and the lag is about 7200 seconds.',
      'There seems to be a blocking query that is preventing the replication from catching up.',
      'I will terminate the long-running query and monitor the replication status.',
    ];

    const result = evaluateCEFR(messages, 180, 'database', 0);

    expect(result.finalFeedback).toContain('Strengths:');
    expect(result.finalFeedback).toContain('Areas for improvement:');
    expect(result.quickFeedback).toBeInstanceOf(Array);
  });

  it('includes clarification tip when many clarifications needed', () => {
    const messages = ['Ok', 'Yes', 'Done'];

    const result = evaluateCEFR(messages, 60, 'database', 5);

    expect(result.finalFeedback).toContain('clarifications');
  });
});

describe('generateQuickFeedback', () => {
  it('suggests more detail on first short message', () => {
    const feedback = generateQuickFeedback('Hi', 1, 'database');

    expect(feedback).toContain('detailed');
  });

  it('suggests technical terms on third message without jargon', () => {
    const feedback = generateQuickFeedback(
      'I see something is wrong with the system.',
      3,
      'database'
    );

    expect(feedback).toContain('technical');
  });

  it('praises long detailed messages', () => {
    const feedback = generateQuickFeedback(
      'I have checked the database replication and found that the lag is at 7200 seconds. ' +
      'There is a blocking query on the primary key index that is preventing the replication ' +
      'from catching up. I will terminate the long-running query and monitor the status.',
      5,
      'database'
    );

    expect(feedback).toContain('Great detail');
  });

  it('returns null for adequate responses', () => {
    const feedback = generateQuickFeedback(
      'The replication lag is at 5000 seconds on the primary replica.',
      2,
      'database'
    );

    expect(feedback).toBeNull();
  });
});
