// CEFR Evaluator - Common European Framework of Reference
// Evaluates English proficiency based on official CEFR descriptors

export interface CEFRLevel {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  score: number; // 0-100
  description: string;
}

export interface CEFRAssessment {
  overall: CEFRLevel;
  pronunciation: CEFRLevel;
  fluency: CEFRLevel;
  vocabulary: CEFRLevel;
  grammar: CEFRLevel;
  interaction: CEFRLevel;
  comprehension: CEFRLevel;
  technicalJargon: {
    level: 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';
    termsUsed: string[];
    accuracy: number;
  };
  quickFeedback: string[];
  finalFeedback: string;
}

// CEFR Descriptors for each skill
const PRONUNCIATION_DESCRIPTORS = {
  'A1': 'Pronunciation is heavily influenced by L1; often difficult to understand',
  'A2': 'Pronunciation generally clear enough to be understood; noticeable L1 accent',
  'B1': 'Pronunciation is clear and intelligible despite noticeable L1 accent',
  'B2': 'Clear, natural pronunciation; L1 accent does not impede communication',
  'C1': 'Can vary intonation and place stress correctly; near-native pronunciation',
  'C2': 'Native-like pronunciation and intonation in all contexts'
};

const FLUENCY_DESCRIPTORS = {
  'A1': 'Very long pauses; can only manage very short isolated utterances',
  'A2': 'Constructs phrases on familiar topics with frequent pausing for planning',
  'B1': 'Can keep going comprehensibly; noticeable pausing for grammatical planning',
  'B2': 'Produces stretches of language at fairly even tempo; few noticeably long pauses',
  'C1': 'Can express ideas fluently and spontaneously; only occasional pausing to plan',
  'C2': 'Can express self spontaneously at length with natural, effortless flow of speech'
};

const VOCABULARY_DESCRIPTORS = {
  'A1': 'Basic vocabulary repertoire for concrete everyday situations',
  'A2': 'Sufficient vocabulary for expressing basic needs in familiar situations',
  'B1': 'Sufficient vocabulary to discuss topics pertaining to everyday life and work',
  'B2': 'Good range of vocabulary; can vary formulation to avoid frequent repetition',
  'C1': 'Good command of broad vocabulary including idiomatic expressions and colloquialisms',
  'C2': 'Consistent mastery of idiomatic and colloquial expressions; nuanced meaning'
};

const GRAMMAR_DESCRIPTORS = {
  'A1': 'Shows only limited control of simple grammatical structures and sentence patterns',
  'A2': 'Uses simple structures correctly but still systematically makes basic mistakes',
  'B1': 'Reasonable accuracy in familiar situations; meaning generally clear despite errors',
  'B2': 'Good grammatical control; occasional slips or non-systematic errors',
  'C1': 'Consistently maintains high degree of grammatical accuracy; errors are rare',
  'C2': 'Maintains consistent grammatical control of complex language, even while attention is elsewhere'
};

const INTERACTION_DESCRIPTORS = {
  'A1': 'Can ask and answer simple questions on very familiar topics',
  'A2': 'Can handle very short social exchanges; often cannot understand enough to keep conversation going',
  'B1': 'Can initiate, maintain and close simple face-to-face conversation on familiar topics',
  'B2': 'Can interact with a degree of fluency that makes regular interaction quite natural',
  'C1': 'Can select a suitable phrase to preface remarks; formulate thoughts and opinions with precision',
  'C2': 'Can interact naturally, effortlessly; backchannelling, referencing and other conversation skills are well developed'
};

const COMPREHENSION_DESCRIPTORS = {
  'A1': 'Can understand familiar everyday expressions and very basic phrases',
  'A2': 'Can understand phrases and highest frequency vocabulary related to immediate relevance',
  'B1': 'Can understand main points on familiar matters regularly encountered in work, leisure, etc.',
  'B2': 'Can understand extended speech and lectures on complex subjects within field of specialization',
  'C1': 'Can understand extended speech even when it is not clearly structured and relationships are only implied',
  'C2': 'Can understand any kind of spoken language with ease, whether live or broadcast'
};

// Convert score (0-100) to CEFR level
function scoreToLevel(score: number): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  if (score >= 95) return 'C2';
  if (score >= 85) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 35) return 'A2';
  return 'A1';
}

// Technical jargon assessment
const TECHNICAL_TERMS = {
  database: [
    'replication', 'lag', 'blocking', 'deadlock', 'query', 'index', 
    'transaction', 'commit', 'rollback', 'stored procedure', 'trigger',
    'primary key', 'foreign key', 'normalization', 'sharding', 'partitioning'
  ],
  network: [
    'latency', 'throughput', 'bandwidth', 'packet loss', 'DNS', 'TCP/IP',
    'firewall', 'load balancer', 'CDN', 'VPN', 'subnet', 'gateway'
  ],
  deployment: [
    'CI/CD', 'container', 'docker', 'kubernetes', 'rollback', 'blue-green',
    'canary', 'pipeline', 'artifact', 'staging', 'production'
  ]
};

// Helper function to create default assessment
function createDefaultAssessment(): CEFRAssessment {
  return {
    overall: { level: 'B1', score: 60, description: 'Overall CEFR level: B1' },
    pronunciation: { level: 'B1', score: 60, description: PRONUNCIATION_DESCRIPTORS['B1'] },
    fluency: { level: 'B1', score: 60, description: FLUENCY_DESCRIPTORS['B1'] },
    vocabulary: { level: 'B1', score: 60, description: VOCABULARY_DESCRIPTORS['B1'] },
    grammar: { level: 'B1', score: 60, description: GRAMMAR_DESCRIPTORS['B1'] },
    interaction: { level: 'B1', score: 60, description: INTERACTION_DESCRIPTORS['B1'] },
    comprehension: { level: 'B1', score: 60, description: COMPREHENSION_DESCRIPTORS['B1'] },
    technicalJargon: { level: 'Basic', termsUsed: [], accuracy: 50 },
    quickFeedback: ['Complete a full conversation to get detailed feedback'],
    finalFeedback: 'No user messages were recorded. Please try the demo again for a complete assessment.'
  };
}

export function evaluateTechnicalJargon(messages: string[], scenarioType: string): {
  level: 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';
  termsUsed: string[];
  accuracy: number;
} {
  const relevantTerms = TECHNICAL_TERMS[scenarioType as keyof typeof TECHNICAL_TERMS] || TECHNICAL_TERMS.database;
  const messagesText = messages.join(' ').toLowerCase();
  
  const termsUsed = relevantTerms.filter(term => 
    messagesText.includes(term.toLowerCase())
  );
  
  const usage = termsUsed.length / relevantTerms.length;
  
  let level: 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';
  if (usage >= 0.5) level = 'Expert';
  else if (usage >= 0.3) level = 'Advanced';
  else if (usage >= 0.15) level = 'Intermediate';
  else level = 'Basic';
  
  const accuracy = Math.round(Math.min(100, termsUsed.length * 10 + 40));
  
  return { level, termsUsed, accuracy };
}

// Main CEFR evaluation function
export function evaluateCEFR(
  userMessages: string[],
  conversationLength: number,
  scenarioType: string = 'database',
  clarificationCount: number = 0
): CEFRAssessment {
  
  console.log('🎯 CEFR Evaluation starting...');
  console.log('  userMessages:', userMessages.length);
  console.log('  conversationLength:', conversationLength);
  console.log('  scenarioType:', scenarioType);
  console.log('  clarificationCount:', clarificationCount);
  
  // Safety checks
  if (!userMessages || userMessages.length === 0) {
    console.warn('⚠️ No messages provided, returning default assessment');
    return createDefaultAssessment();
  }
  
  // Calculate individual scores based on heuristics
  // In production, these would use ML models or more sophisticated analysis
  
  const messageCount = userMessages.length;
  const avgMessageLength = userMessages.reduce((sum, msg) => sum + msg.split(' ').length, 0) / messageCount;
  const totalWords = userMessages.join(' ').split(' ').length;
  const uniqueWords = new Set(userMessages.join(' ').toLowerCase().split(' ')).size;
  const vocabularyDiversity = uniqueWords / totalWords;
  
  // CLARITY PENALTY: Each clarification reduces scores
  // More clarifications = user was unclear/vague
  const clarityPenalty = Math.min(30, clarificationCount * 3); // Max -30 points
  console.log(`🎯 Clarity Penalty: -${clarityPenalty} (${clarificationCount} clarifications needed)`);
  
  // Pronunciation (simulated - in reality would use voice analysis)
  // For now, based on message complexity
  const pronunciationScore = Math.round(Math.max(0, Math.min(100, 60 + avgMessageLength * 3 - clarityPenalty / 2)));
  const pronunciation: CEFRLevel = {
    level: scoreToLevel(pronunciationScore),
    score: pronunciationScore,
    description: PRONUNCIATION_DESCRIPTORS[scoreToLevel(pronunciationScore)]
  };
  
  // Fluency (based on message count and avg length) - PENALIZED by clarifications
  const fluencyScore = Math.round(Math.max(0, Math.min(100, 50 + messageCount * 4 + avgMessageLength * 2 - clarityPenalty)));
  const fluency: CEFRLevel = {
    level: scoreToLevel(fluencyScore),
    score: fluencyScore,
    description: FLUENCY_DESCRIPTORS[scoreToLevel(fluencyScore)]
  };
  
  // Vocabulary (based on diversity and message length)
  const vocabularyScore = Math.round(Math.max(0, Math.min(100, 40 + vocabularyDiversity * 100 + avgMessageLength - clarityPenalty / 3)));
  const vocabulary: CEFRLevel = {
    level: scoreToLevel(vocabularyScore),
    score: vocabularyScore,
    description: VOCABULARY_DESCRIPTORS[scoreToLevel(vocabularyScore)]
  };
  
  // Grammar (simulated - would need NLP analysis)
  const grammarScore = Math.round(Math.max(0, Math.min(100, 55 + avgMessageLength * 2 + messageCount * 2 - clarityPenalty / 2)));
  const grammar: CEFRLevel = {
    level: scoreToLevel(grammarScore),
    score: grammarScore,
    description: GRAMMAR_DESCRIPTORS[scoreToLevel(grammarScore)]
  };
  
  // Interaction (based on message count and responsiveness) - HEAVILY PENALIZED
  // Clarifications = poor interaction/clarity
  const interactionScore = Math.round(Math.max(0, Math.min(100, 50 + messageCount * 5 - clarityPenalty * 1.5)));
  const interaction: CEFRLevel = {
    level: scoreToLevel(interactionScore),
    score: interactionScore,
    description: INTERACTION_DESCRIPTORS[scoreToLevel(interactionScore)]
  };
  
  // Comprehension (simulated based on appropriate responses) - PENALIZED
  // If Sarah had to ask clarifications = poor comprehension/expression
  const comprehensionScore = Math.round(Math.max(0, Math.min(100, 65 + messageCount * 3 - clarityPenalty)));
  const comprehension: CEFRLevel = {
    level: scoreToLevel(comprehensionScore),
    score: comprehensionScore,
    description: COMPREHENSION_DESCRIPTORS[scoreToLevel(comprehensionScore)]
  };
  
  // Technical jargon
  const technicalJargon = evaluateTechnicalJargon(userMessages, scenarioType);
  
  // Overall score (weighted average)
  const overallScore = Math.round(
    (pronunciation.score * 0.15) +
    (fluency.score * 0.20) +
    (vocabulary.score * 0.20) +
    (grammar.score * 0.15) +
    (interaction.score * 0.15) +
    (comprehension.score * 0.15)
  );
  
  const overall: CEFRLevel = {
    level: scoreToLevel(overallScore),
    score: overallScore,
    description: `Overall CEFR level: ${scoreToLevel(overallScore)}`
  };
  
  // Generate quick feedback
  const quickFeedback: string[] = [];
  
  if (technicalJargon.level === 'Expert') {
    quickFeedback.push('Excellent use of technical terminology');
  } else if (technicalJargon.level === 'Advanced') {
    quickFeedback.push('Good technical vocabulary');
  }
  
  if (fluency.score >= 80) {
    quickFeedback.push('Smooth conversation flow');
  }
  
  if (vocabulary.score < 60) {
    quickFeedback.push('Try using more varied vocabulary');
  }
  
  if (avgMessageLength < 5) {
    quickFeedback.push('Try expressing ideas in more complete sentences');
  }
  
  // Generate final feedback based on actual performance
  const strengths: string[] = [];
  const improvements: string[] = [];
  
  // Identify strengths (scores >= 70)
  if (fluency.score >= 70) {
    strengths.push(fluency.score >= 80 ? '• Excellent fluency and natural conversation flow' : '• Good fluency in communication');
  }
  if (vocabulary.score >= 70) {
    strengths.push(vocabulary.score >= 80 ? '• Strong vocabulary range' : '• Adequate vocabulary for the scenario');
  }
  if (grammar.score >= 70) {
    strengths.push(grammar.score >= 80 ? '• Excellent grammatical accuracy' : '• Good grammar usage');
  }
  if (interaction.score >= 70) {
    strengths.push(interaction.score >= 80 ? '• Highly effective communication' : '• Good interactive communication');
  }
  if (comprehension.score >= 70) {
    strengths.push('• Good comprehension of technical scenarios');
  }
  if (technicalJargon.level === 'Advanced' || technicalJargon.level === 'Expert') {
    strengths.push('• Strong technical vocabulary and terminology');
  } else if (technicalJargon.level === 'Intermediate') {
    strengths.push('• Adequate use of technical terms');
  }
  
  // Identify areas for improvement (scores < 70)
  if (pronunciation.score < 70) {
    improvements.push(pronunciation.score < 50 ? '• Significant focus needed on pronunciation clarity' : '• Work on pronunciation clarity');
  }
  if (fluency.score < 70) {
    improvements.push(fluency.score < 50 ? '• Practice speaking with fewer pauses' : '• Improve conversation flow and reduce pausing');
  }
  if (vocabulary.score < 70) {
    improvements.push(vocabulary.score < 50 ? '• Significantly expand vocabulary range' : '• Expand general vocabulary');
  }
  if (grammar.score < 70) {
    improvements.push(grammar.score < 50 ? '• Focus heavily on grammatical accuracy' : '• Work on grammatical accuracy');
  }
  if (interaction.score < 70) {
    improvements.push('• Practice providing more specific and detailed responses');
  }
  if (comprehension.score < 70) {
    improvements.push('• Focus on understanding technical context better');
  }
  if (clarificationCount > 5) {
    improvements.push(`• Reduce vague responses (${clarificationCount} clarifications needed)`);
  }
  
  // If no weaknesses found, add encouragement
  if (improvements.length === 0) {
    improvements.push('• Continue practicing to maintain proficiency');
  }
  
  // If no strengths found (very low performance), add something positive
  if (strengths.length === 0) {
    strengths.push('• You completed the conversation - keep practicing!');
  }
  
  const finalFeedback = `
Your overall CEFR level is ${overall.level}. 

Strengths:
${strengths.join('\n')}

Areas for improvement:
${improvements.join('\n')}
${clarificationCount > 3 ? `\n\n💡 Tip: You needed ${clarificationCount} clarifications. Practice being more specific and detailed in your responses.` : ''}
`.trim();
  
  return {
    overall,
    pronunciation,
    fluency,
    vocabulary,
    grammar,
    interaction,
    comprehension,
    technicalJargon,
    quickFeedback,
    finalFeedback
  };
}

// Generate real-time feedback during conversation
export function generateQuickFeedback(
  currentMessage: string,
  messageNumber: number,
  scenarioType: string
): string | null {
  const words = currentMessage.split(' ');
  const length = words.length;
  
  // Feedback triggers
  if (messageNumber === 1 && length < 5) {
    return 'Try to provide more detailed responses';
  }
  
  if (messageNumber === 3) {
    const technicalTerms = TECHNICAL_TERMS[scenarioType as keyof typeof TECHNICAL_TERMS] || [];
    const hasTerms = technicalTerms.some(term => currentMessage.toLowerCase().includes(term.toLowerCase()));
    if (!hasTerms) {
      return 'Use specific technical terminology when describing the issue';
    }
  }
  
  if (length > 30) {
    return 'Great detail! Clear explanation';
  }
  
  return null;
}
