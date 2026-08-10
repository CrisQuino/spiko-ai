import { NextResponse } from 'next/server';
import { getLanguage } from '@/lib/languages';
import { chatComplete, resolveProvider } from '@/lib/llm';
import { evaluateCEFR, type CEFRAssessment } from '@/lib/cefr-evaluator';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

function buildRubricPrompt(languageName: string, targetLevel?: string | null): string {
  return `You are a STRICT, certified CEFR examiner for ${languageName}. You assess a learner's ${languageName} from a transcript of what THEY said during a spoken role-play (their turns were transcribed by speech-to-text).

Assess RIGOROUSLY and HONESTLY against official CEFR descriptors. Do NOT inflate. Most learners are A2–B1; only award B2+ when the language genuinely shows it (wide range, complex structures used accurately, precise vocabulary, cohesive discourse). Short or simple-but-correct answers are NOT high level.

What you CAN judge from a transcript: vocabulary range/precision, grammatical range/accuracy, coherence/cohesion, interaction, and task achievement. You CANNOT truly hear pronunciation or fluency — estimate those conservatively from sentence construction and hesitation markers, and never rate them above the overall.

${targetLevel ? `The learner self-reported level ${targetLevel}. Use it only as a reference; judge what the transcript actually shows (it may be higher or lower).` : ''}

Base every score on EVIDENCE from the transcript. In feedback, cite specific examples (quote short fragments) and give concrete, actionable next steps. Write ALL feedback text in ${languageName}.

Return ONLY a JSON object (no markdown, no prose) with EXACTLY this shape:
{
  "overall": {"level":"A1|A2|B1|B2|C1|C2","score":0-100,"description":"one short sentence"},
  "vocabulary": {"level":"...","score":0-100,"description":"..."},
  "grammar": {"level":"...","score":0-100,"description":"..."},
  "fluency": {"level":"...","score":0-100,"description":"conservative, text-based estimate"},
  "pronunciation": {"level":"...","score":0-100,"description":"cannot be heard; conservative estimate"},
  "interaction": {"level":"...","score":0-100,"description":"..."},
  "comprehension": {"level":"...","score":0-100,"description":"..."},
  "technicalJargon": {"level":"Basic|Intermediate|Advanced|Expert","termsUsed":["..."],"accuracy":0-100},
  "quickFeedback": ["2-4 short, specific bullets"],
  "finalFeedback": "a short paragraph: level justification with examples + top priorities to improve"
}
The score must be consistent with the level band (A1 ~0-25, A2 ~25-40, B1 ~40-58, B2 ~58-75, C1 ~75-88, C2 ~88-100).`;
}

function coerceLevel(v: any): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' {
  return LEVELS.includes(v) ? v : 'B1';
}

function coerceSkill(v: any, fallbackDesc = '') {
  return {
    level: coerceLevel(v?.level),
    score: typeof v?.score === 'number' ? Math.max(0, Math.min(100, Math.round(v.score))) : 50,
    description: typeof v?.description === 'string' ? v.description : fallbackDesc,
  };
}

function coerceAssessment(raw: any): CEFRAssessment {
  return {
    overall: coerceSkill(raw?.overall),
    pronunciation: coerceSkill(raw?.pronunciation),
    fluency: coerceSkill(raw?.fluency),
    vocabulary: coerceSkill(raw?.vocabulary),
    grammar: coerceSkill(raw?.grammar),
    interaction: coerceSkill(raw?.interaction),
    comprehension: coerceSkill(raw?.comprehension),
    technicalJargon: {
      level: ['Basic', 'Intermediate', 'Advanced', 'Expert'].includes(raw?.technicalJargon?.level)
        ? raw.technicalJargon.level
        : 'Basic',
      termsUsed: Array.isArray(raw?.technicalJargon?.termsUsed) ? raw.technicalJargon.termsUsed.slice(0, 20) : [],
      accuracy: typeof raw?.technicalJargon?.accuracy === 'number' ? raw.technicalJargon.accuracy : 50,
    },
    quickFeedback: Array.isArray(raw?.quickFeedback) ? raw.quickFeedback.slice(0, 5).map(String) : [],
    finalFeedback: typeof raw?.finalFeedback === 'string' ? raw.finalFeedback : '',
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { messages = [], language = 'en', level = null } = body as any;
  const lang = getLanguage(language);
  const userMessages: string[] = (messages as Array<{ role: string; content: string }>)
    .filter((m) => m?.role === 'user')
    .map((m) => m.content);

  try {
    // Not enough to assess → fall back to the heuristic.
    if (userMessages.length === 0) {
      return NextResponse.json({ assessment: evaluateCEFR(userMessages, 0, 'production_incident', 0), source: 'heuristic' });
    }

    const transcript = userMessages.map((m, i) => `${i + 1}. ${m}`).join('\n');

    const result = await chatComplete({
      provider: resolveProvider(),
      system: buildRubricPrompt(lang.promptName, level),
      messages: [{ role: 'user', content: `Learner transcript (their ${lang.promptName} turns only):\n\n${transcript}` }],
      maxTokens: 900,
    });

    // Strip any markdown fences and parse the JSON object.
    let text = result.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

    const parsed = JSON.parse(text);
    const assessment = coerceAssessment(parsed);

    return NextResponse.json({ assessment, source: 'llm', tokenUsage: result.usage });
  } catch (error) {
    console.error('Error in /api/evaluate, falling back to heuristic:', error);
    // Never fail the user's result screen — fall back to the heuristic evaluator.
    return NextResponse.json({
      assessment: evaluateCEFR(userMessages, 0, 'production_incident', 0),
      source: 'heuristic-fallback',
    });
  }
}
